import { createHash } from "node:crypto";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export function getMissingCloudinaryEnvVars() {
  return [
    !process.env.CLOUDINARY_CLOUD_NAME ? "CLOUDINARY_CLOUD_NAME" : null,
    !process.env.CLOUDINARY_API_KEY ? "CLOUDINARY_API_KEY" : null,
    !process.env.CLOUDINARY_API_SECRET ? "CLOUDINARY_API_SECRET" : null,
  ].filter(Boolean) as string[];
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || "motoclubjujuy/gallery";

  if (getMissingCloudinaryEnvVars().length > 0) {
    return null;
  }

  return {
    cloudName: cloudName as string,
    apiKey: apiKey as string,
    apiSecret: apiSecret as string,
    folder,
  };
}

export function buildCloudinarySignature(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string
) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export function buildCloudinaryBasicAuth(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

export function escapeCloudinaryContextValue(value: string) {
  return value.replace(/[\\|=]/g, "\\$&");
}
