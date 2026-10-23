import type { MotoclubContent } from "./site-data";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export function parseAdminPhotoAuthorization(value: string | null) {
  const parts = value?.trim().split(/\s+/) ?? [];

  if (parts.length !== 2 || parts[0].toLowerCase() !== "basic") {
    return null;
  }

  const encoded = parts[1];
  if (encoded.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return null;
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");

  if (Buffer.from(decoded, "utf8").toString("base64") !== encoded || separator < 1) {
    return null;
  }

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

function imageTypeFromSignature(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    )
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export async function validatePhotoFile(file: File) {
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return "La imagen debe tener un tamaño de hasta 4 MB.";
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Solo se admiten imágenes JPG, PNG o WebP.";
  }

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (imageTypeFromSignature(signature) !== file.type) {
    return "El contenido del archivo no coincide con su formato de imagen.";
  }

  return null;
}

type PhotoDeletionPlan =
  | { ok: false; reason: "not-found" | "not-owned" | "in-use" }
  | { ok: true; photos: MotoclubContent["fotos"] };

const cloudinaryImageFormats = new Set([
  "jpg", "jpeg", "png", "webp", "avif", "gif", "svg", "bmp", "tif", "tiff",
  "heic", "heif", "jxl", "jp2", "ico", "apng", "pdf",
]);

/** Compare a delivery URL with an exact image public ID in this Cloudinary account. */
export function isCloudinaryImageUrlForPublicId(url: string, cloudName: string, publicId: string) {
  if (!cloudName || !publicId) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.hostname !== "res.cloudinary.com" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return false;
    }

    const path = parsed.pathname.split("/").slice(1).map(decodeURIComponent);
    if (path[0] !== cloudName || path[1] !== "image" || path[2] !== "upload") {
      return false;
    }

    const publicIdParts = publicId.split("/");
    const deliveryParts = path.slice(3);
    if (deliveryParts.length < publicIdParts.length || publicIdParts.some((part) => !part)) {
      return false;
    }

    const idStart = deliveryParts.length - publicIdParts.length;
    const matchingId = publicIdParts.every((part, index) => {
      const delivered = deliveryParts[idStart + index];
      if (index !== publicIdParts.length - 1) {
        return delivered === part;
      }

      if (delivered === part) {
        return true;
      }

      const extension = delivered?.startsWith(`${part}.`) ? delivered.slice(part.length + 1) : "";
      return cloudinaryImageFormats.has(extension.toLowerCase());
    });
    if (!matchingId) {
      return false;
    }

    const beforeId = deliveryParts.slice(0, idStart);
    if (beforeId.length === 0) {
      return true;
    }

    // Cloudinary upload URLs include /vN/. Without a version, only recognizable
    // transformation components are accepted; an arbitrary folder is another ID.
    if (/^v\d+$/.test(beforeId[beforeId.length - 1])) {
      return true;
    }

    return beforeId.every((part) => /^(?:[a-z]{1,3}_|\$|s--[A-Za-z0-9_-]+--$)/.test(part));
  } catch {
    return false;
  }
}

export function planPhotoDeletion(
  content: MotoclubContent,
  settings: { heroImage?: string },
  publicId: string,
  cloudName: string
): PhotoDeletionPlan {
  const matches = content.fotos.filter((photo) => photo.publicId === publicId);
  if (matches.length === 0) {
    return { ok: false, reason: "not-found" };
  }

  if (matches.some((photo) => !isCloudinaryImageUrlForPublicId(photo.url, cloudName, publicId))) {
    return { ok: false, reason: "not-owned" };
  }

  const urls = new Set(matches.map((photo) => photo.url).filter(Boolean));
  const usesUrl = (url: string | undefined) =>
    Boolean(url && (urls.has(url) || isCloudinaryImageUrlForPublicId(url, cloudName, publicId)));
  const embeddedUrls = content.quienes.match(/https?:\/\/[^\s"'<>)]*/gi) || [];
  const usedElsewhere =
    content.fotos.some((photo) => photo.publicId !== publicId && usesUrl(photo.url)) ||
    content.events.some(
      (event) =>
        usesUrl(event.posterUrl) ||
        usesUrl(event.coverImage) ||
        event.dayItems.some((day) => usesUrl(day.imageUrl))
    ) ||
    content.novedades.some((item) => usesUrl(item.imageUrl) || usesUrl(item.coverImage)) ||
    usesUrl(settings.heroImage) ||
    [...urls].some((url) => content.quienes.includes(url)) ||
    embeddedUrls.some((url) =>
      url.split(/,(?=https?:\/\/)/i).some((part) => usesUrl(part.replace(/[;,]+$/, "")))
    );

  if (usedElsewhere) {
    return { ok: false, reason: "in-use" };
  }

  return { ok: true, photos: content.fotos.filter((photo) => photo.publicId !== publicId) };
}
