import { NextResponse } from "next/server";
import {
  buildCloudinaryBasicAuth,
  buildCloudinarySignature,
  escapeCloudinaryContextValue,
  getCloudinaryConfig,
} from "@/lib/cloudinary";
import type { MotoPhoto } from "@/lib/site-data";

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
  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no estA configurado en el servidor." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sourceUrl = String(formData.get("sourceUrl") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();

  const uploadSource =
    file instanceof File ? file : sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://") ? sourceUrl : null;

  if (!uploadSource) {
    return NextResponse.json(
      { error: "DebEs subir un archivo o indicar una URL pUblica." },
      { status: 400 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const contextEntries = [
    title ? `title=${escapeCloudinaryContextValue(title)}` : "",
    description ? `description=${escapeCloudinaryContextValue(description)}` : "",
  ].filter(Boolean);
  const context = contextEntries.join("|");

  const signatureParams = {
    context,
    display_name: title || "Nueva imagen",
    folder: config.folder,
    timestamp,
  };

  const uploadBody = new FormData();
  uploadBody.set("file", uploadSource);
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
  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no estA configurado en el servidor." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as { publicId?: string };
  const publicId = payload.publicId?.trim();

  if (!publicId) {
    return NextResponse.json({ error: "Falta el publicId de la imagen." }, { status: 400 });
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

  const destroyResponse = (await response.json()) as { result?: string; error?: { message?: string } };

  if (!response.ok || destroyResponse.result !== "ok") {
    return NextResponse.json(
      { error: destroyResponse.error?.message || "No se pudo eliminar la imagen." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
