import { NextResponse } from "next/server";
import {
  buildCloudinaryBasicAuth,
  buildCloudinarySignature,
  escapeCloudinaryContextValue,
  getCloudinaryConfig,
} from "@/lib/cloudinary";
import {
  MAX_PHOTO_BYTES,
  parseAdminPhotoAuthorization,
  planPhotoDeletion,
  validatePhotoFile,
} from "@/lib/photo-security";
import type { MotoPhoto } from "@/lib/site-data";
import { getSupabaseAdmin, validateAdminCredentials } from "@/lib/supabase-admin";
import { readSiteContentState } from "@/lib/site-content-store";
import { isSiteContentVersionCurrent, nextSiteContentUpdatedAt } from "@/lib/site-content-version";

type CloudinaryResource = {
  public_id?: string;
  secure_url?: string;
  display_name?: string;
  context?: {
    custom?: Record<string, string>;
  };
};

function toMotoPhoto(resource: CloudinaryResource): MotoPhoto | null {
  if (!resource.secure_url) {
    return null;
  }

  return {
    url: resource.secure_url,
    titulo: resource.display_name || "Nueva imagen",
    descripcion: resource.context?.custom?.description || "",
    publicId: resource.public_id,
  };
}

function adminAuthError(request: Request) {
  const credentials = parseAdminPhotoAuthorization(request.headers.get("authorization"));
  if (!credentials || !validateAdminCredentials(credentials.username, credentials.password)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json({ enabled: false, photos: [] });
  }

  const apiUrl = new URL(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/by_asset_folder`);
  apiUrl.searchParams.set("asset_folder", config.folder);
  apiUrl.searchParams.set("max_results", "100");
  apiUrl.searchParams.set("direction", "desc");

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: buildCloudinaryBasicAuth(config.apiKey, config.apiSecret),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    const folderMissing = detail.includes("Folder doesn't exist");

    if (folderMissing) {
      return NextResponse.json({ enabled: true, photos: [] });
    }

    return NextResponse.json(
      {
        enabled: true,
        photos: [],
        error: "No se pudo leer la galerIa de Cloudinary.",
        detail,
      },
      { status: 500 }
    );
  }

  const payload = (await response.json()) as { resources?: CloudinaryResource[] };
  const photos = (payload.resources || []).map(toMotoPhoto).filter((photo): photo is MotoPhoto => Boolean(photo));

  return NextResponse.json({ enabled: true, photos });
}

export async function POST(request: Request) {
  const authError = adminAuthError(request);
  if (authError) {
    return authError;
  }

  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no estA configurado en el servidor." },
      { status: 500 }
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Se esperaba un formulario con una imagen." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_PHOTO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "La imagen supera el límite de 4 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const file = formData.get("file");
  if (formData.has("sourceUrl")) {
    return NextResponse.json(
      { error: "Por seguridad, descargá la imagen y subí el archivo desde tu equipo." },
      { status: 400 }
    );
  }

  if (formData.getAll("file").length !== 1 || !(file instanceof File)) {
    return NextResponse.json({ error: "Debés seleccionar una imagen." }, { status: 400 });
  }

  const titleValue = formData.get("title");
  const descriptionValue = formData.get("description");
  if (
    (titleValue !== null && typeof titleValue !== "string") ||
    (descriptionValue !== null && typeof descriptionValue !== "string")
  ) {
    return NextResponse.json({ error: "Los datos de la imagen no son válidos." }, { status: 400 });
  }

  const title = (titleValue || "").trim();
  const description = (descriptionValue || "").trim();
  if (title.length > 120 || description.length > 500) {
    return NextResponse.json({ error: "El título o la descripción son demasiado largos." }, { status: 400 });
  }

  const fileError = await validatePhotoFile(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const contextEntries = [
    title ? `title=${escapeCloudinaryContextValue(title)}` : "",
    description ? `description=${escapeCloudinaryContextValue(description)}` : "",
  ].filter(Boolean);
  const context = contextEntries.join("|");

  const signatureParams = {
    allowed_formats: "jpg,png,webp",
    context,
    display_name: title || "Nueva imagen",
    folder: config.folder,
    timestamp,
  };

  const uploadBody = new FormData();
  uploadBody.set("file", file);
  uploadBody.set("allowed_formats", "jpg,png,webp");
  uploadBody.set("folder", config.folder);
  uploadBody.set("timestamp", String(timestamp));
  uploadBody.set("api_key", config.apiKey);
  uploadBody.set("display_name", title || "Nueva imagen");

  if (context) {
    uploadBody.set("context", context);
  }

  uploadBody.set(
    "signature",
    buildCloudinarySignature(signatureParams, config.apiSecret)
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body: uploadBody,
    }
  );

  const payload = (await response.json()) as CloudinaryResource & { error?: { message?: string } };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message || "No se pudo subir la imagen a Cloudinary." },
      { status: 500 }
    );
  }

  const photo = toMotoPhoto(payload);

  return NextResponse.json({ photo });
}

export async function DELETE(request: Request) {
  const authError = adminAuthError(request);
  if (authError) {
    return authError;
  }

  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no estA configurado en el servidor." },
      { status: 500 }
    );
  }

  let payload: { publicId?: unknown; expectedUpdatedAt?: unknown };
  try {
    payload = (await request.json()) as { publicId?: unknown; expectedUpdatedAt?: unknown };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const publicId = typeof payload?.publicId === "string" ? payload.publicId.trim() : "";

  if (!publicId || publicId.length > 500) {
    return NextResponse.json({ error: "Identificador de imagen inválido." }, { status: 400 });
  }

  const folder = config.folder.replace(/^\/+|\/+$/g, "");
  if (!folder || !publicId.startsWith(`${folder}/`)) {
    return NextResponse.json(
      { error: "La imagen no pertenece a la carpeta administrada por este sitio." },
      { status: 403 }
    );
  }

  const current = await readSiteContentState();
  if (!current.ok) {
    return NextResponse.json({ error: current.error }, { status: current.status });
  }

  if (
    !Object.prototype.hasOwnProperty.call(payload, "expectedUpdatedAt") ||
    (payload.expectedUpdatedAt !== null &&
      (typeof payload.expectedUpdatedAt !== "string" || !payload.expectedUpdatedAt))
  ) {
    return NextResponse.json(
      { error: "Falta la versión de la galería. Recargá ADMIN antes de borrar." },
      { status: 428 }
    );
  }

  if (!isSiteContentVersionCurrent(payload.expectedUpdatedAt as string | null, current.state.updatedAt)) {
    return NextResponse.json(
      { error: "El contenido cambió en otra pestaña. No se borró la imagen; recargá ADMIN para revisar los cambios." },
      { status: 409 }
    );
  }

  const deletion = planPhotoDeletion(current.state.content, current.state.settings, publicId, config.cloudName);
  if (!deletion.ok) {
    return NextResponse.json(
      {
        error:
          deletion.reason === "in-use"
            ? "La imagen también se usa en otra sección. Quitá esa referencia antes de borrarla."
            : deletion.reason === "not-owned"
              ? "La imagen registrada no coincide con una imagen de este sitio en Cloudinary."
            : "Imagen no encontrada en la galería.",
      },
      { status: deletion.reason === "in-use" ? 409 : deletion.reason === "not-owned" ? 403 : 404 }
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });
  }

  if (!current.state.updatedAt) {
    return NextResponse.json({ error: "No se pudo comprobar la versión de la galería." }, { status: 409 });
  }

  const { data, error } = await admin
    .from("site_content")
    .update({
      fotos: deletion.photos,
      updated_at: nextSiteContentUpdatedAt(current.state.updatedAt, Date.now()),
    })
    .eq("slug", "main")
    .eq("updated_at", current.state.updatedAt)
    .select("fotos, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "No se pudo quitar la imagen de Supabase. El archivo sigue intacto." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "La galería cambió durante el borrado. Actualizá la página e intentá nuevamente." },
      { status: 409 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const destroyBody = new URLSearchParams();
  destroyBody.set("public_id", publicId);
  destroyBody.set("timestamp", String(timestamp));
  destroyBody.set("api_key", config.apiKey);
  destroyBody.set(
    "signature",
    buildCloudinarySignature({ public_id: publicId, timestamp }, config.apiSecret)
  );

  let cleanupPending = false;
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: destroyBody.toString(),
      }
    );
    const destroyResponse = (await response.json()) as { result?: string };
    cleanupPending =
      !response.ok || !["ok", "not found", "not_found"].includes(destroyResponse.result || "");
  } catch {
    cleanupPending = true;
  }

  return NextResponse.json({
    ok: true,
    photos: deletion.photos,
    updatedAt: data.updated_at,
    cleanupPending,
    warning: cleanupPending
      ? "La imagen se quitó del sitio, pero falta eliminar el archivo de Cloudinary."
      : undefined,
  });
}
