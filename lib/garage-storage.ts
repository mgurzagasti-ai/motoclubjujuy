import { buildCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary";
import { validatePhotoFile } from "@/lib/photo-security";

export type GarageStoredPhoto = { url: string; provider: string; storageKey: string };

export async function storeGaragePhoto(file: File, ownerId: string): Promise<GarageStoredPhoto> {
  const validationError = await validatePhotoFile(file);
  if (validationError) throw new Error(validationError);
  const config = getCloudinaryConfig();
  if (!config) throw new Error("El almacenamiento de fotos no está configurado.");
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${config.folder}/garage/${ownerId}`;
  const params = { folder, timestamp, allowed_formats: "jpg,png,webp" };
  const body = new FormData();
  body.set("file", file);
  body.set("folder", folder);
  body.set("timestamp", String(timestamp));
  body.set("allowed_formats", params.allowed_formats);
  body.set("api_key", config.apiKey);
  body.set("signature", buildCloudinarySignature(params, config.apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST", body,
  });
  const data = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !data.secure_url || !data.public_id)
    throw new Error(data.error?.message || "No se pudo almacenar la foto.");
  return { url: data.secure_url, provider: "cloudinary", storageKey: data.public_id };
}
