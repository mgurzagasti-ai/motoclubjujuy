import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import {
  buildCloudinarySignature,
  escapeCloudinaryContextValue,
  getCloudinaryConfig,
} from "@/lib/cloudinary";

type CloudinaryUploadResponse = {
  public_id?: string;
  original_filename?: string;
  secure_url?: string;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const config = getCloudinaryConfig();

  if (!config) {
    return NextResponse.json(
      { success: false, error: "Cloudinary no esta configurado en el servidor." },
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
      { success: false, error: "Debes enviar un archivo en el campo file o una sourceUrl publica." },
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

  uploadBody.set("signature", buildCloudinarySignature(signatureParams, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: uploadBody,
  });

  const payload = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !payload.secure_url) {
    return NextResponse.json(
      { success: false, error: payload.error?.message || "No se pudo subir la imagen." },
      { status: 500 }
    );
  }

  const filename =
    payload.original_filename || payload.public_id?.split("/").pop() || `upload-${Date.now().toString()}`;

  return NextResponse.json({
    success: true,
    url: payload.secure_url,
    filename,
  });
}
