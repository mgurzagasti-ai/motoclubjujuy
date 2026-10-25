export const garageDefaultCategories = [
  { slug: "motos", label: "Motos" },
  { slug: "repuestos", label: "Repuestos" },
  { slug: "accesorios", label: "Accesorios" },
  { slug: "indumentaria", label: "Indumentaria" },
  { slug: "otros", label: "Otros" },
] as const;

export const GARAGE_MAX_PHOTOS = 5;
export const GARAGE_MAX_UPLOADS_PER_HOUR = 20;
export const GARAGE_MAX_SUBMISSIONS_PER_HOUR = 5;

export type GarageStatus = "pending" | "approved" | "rejected" | "hidden" | "sold";
export type GarageCategory = { slug: string; label: string; active: boolean };
export type GarageListing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category_slug: string;
  price: number | null;
  whatsapp: string;
  images: string[];
  status: GarageStatus;
  created_at: string;
  updated_at: string;
  submitted_at: string;
};

export type GarageDraft = Pick<GarageListing, "title" | "description" | "category_slug" | "price" | "whatsapp" | "images">;

export function garageWhatsappHref(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

export function validateGarageDraft(value: unknown): { ok: true; draft: GarageDraft } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, error: "El anuncio no es válido." };
  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const category = typeof input.category_slug === "string" ? input.category_slug.trim() : "";
  const whatsapp = typeof input.whatsapp === "string" ? input.whatsapp.trim() : "";
  if (title.length < 4 || title.length > 120) return { ok: false, error: "El título debe tener entre 4 y 120 caracteres." };
  if (description.length < 10 || description.length > 3000) return { ok: false, error: "La descripción debe tener entre 10 y 3000 caracteres." };
  if (!/^[a-z0-9-]{2,40}$/.test(category)) return { ok: false, error: "Elegí una categoría válida." };
  if (!garageWhatsappHref(whatsapp)) return { ok: false, error: "Ingresá un WhatsApp con código de país (8 a 15 dígitos)." };
  const price = input.price === "" || input.price === null || input.price === undefined ? null : Number(input.price);
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 999999999))
    return { ok: false, error: "El precio debe ser un número positivo o quedar vacío." };
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > GARAGE_MAX_PHOTOS ||
    input.images.some((url) => typeof url !== "string" || !/^https:\/\/[^\s]+$/i.test(url)))
    return { ok: false, error: `Adjuntá entre 1 y ${GARAGE_MAX_PHOTOS} fotos válidas.` };
  if (new Set(input.images).size !== input.images.length)
    return { ok: false, error: "No repitas fotografías en el anuncio." };
  return { ok: true, draft: { title, description, category_slug: category, price, whatsapp, images: input.images as string[] } };
}
