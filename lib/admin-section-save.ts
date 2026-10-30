import type { SiteContentChanges, SiteContentState } from "@/lib/site-content-store";
import type { SiteSettings } from "@/lib/site-settings";
import { publishedEvents } from "@/lib/public-content";
import type { ClubEvent, NavItem, NewsItem, MotoPhoto } from "@/lib/site-data";

export type AdminSection = "settings" | "about" | "nav" | "events" | "news" | "photos";
type Result =
  | { ok: true; changes: SiteContentChanges; featuredEventId?: string }
  | { ok: false; error: string };

const textSettingKeys = new Set([
  "clubName", "clubTagline", "introButtonLabel", "aboutTitle", "newsTitle", "galleryTitle",
  "contactTitle", "footerDescription", "footerLegal", "footerContactTitle", "footerContactText",
  "footerCredit", "logoUrl", "aboutImageUrl",
  "heroEyebrow", "heroTitle", "heroSubtitle", "heroImage", "heroPrimaryLabel",
  "heroPrimaryHref", "heroSecondaryLabel", "heroSecondaryHref", "contactText",
  "lodgingTitle", "lodgingEyebrow", "lodgingDescription", "lodgingImageUrl",
  "lodgingLinkLabel", "lodgingLinkUrl",
]);
const imageSettingKeys = new Set(["logoUrl", "aboutImageUrl", "heroImage", "lodgingImageUrl"]);
const linkSettingKeys = new Set(["heroPrimaryHref", "heroSecondaryHref", "lodgingLinkUrl"]);
const safeImage = /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp);base64,)/i;
const safeLink = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unchanged(item: unknown, previous: unknown[]): boolean {
  const serialized = JSON.stringify(item);
  return previous.some((old) => JSON.stringify(old) === serialized);
}

function collection(value: unknown, previous: unknown[], section: string, required: "name" | "title" | "url" | "label") {
  if (!Array.isArray(value)) return `${section}: el listado no es válido.`;
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return `${section}: el registro ${index + 1} no es válido.`;
    if (unchanged(item, previous)) continue;
    if (required === "url") {
      if (typeof item.url !== "string")
        return `${section}: la URL de la fotografía ${index + 1} debe ser texto.`;
      if (item.url.trim() && !safeImage.test(item.url.trim()))
        return `${section}: la fotografía ${index + 1} tiene una URL no permitida.`;
    } else if (typeof item.id !== "string" || !item.id.trim()) {
      return `${section}: el registro ${index + 1} necesita un identificador.`;
    } else if (required === "label") {
      if (typeof item.label !== "string" || typeof item.href !== "string")
        return `${section}: el enlace ${index + 1} necesita etiqueta y dirección de texto.`;
      if (item.href.trim() && !safeLink.test(item.href.trim()))
        return `${section}: el enlace ${index + 1} tiene una dirección no permitida.`;
    } else if (typeof item[required] !== "string") {
      return required === "name"
        ? `${section}: el nombre del evento ${index + 1} debe ser texto.`
        : `${section}: el título de la novedad ${index + 1} debe ser texto.`;
    }
    if (item.published !== undefined && typeof item.published !== "boolean")
      return `${section}: el estado de publicación del registro ${index + 1} no es válido.`;
    if (item.visible !== undefined && typeof item.visible !== "boolean")
      return `${section}: la visibilidad del registro ${index + 1} no es válida.`;
    if (required === "name" && (typeof item.posterUrl !== "string" ||
      (item.posterUrl.trim() && !safeImage.test(item.posterUrl.trim()))))
      return `${section}: el evento ${index + 1} tiene una URL de afiche no permitida.`;
    if (required === "title" && (typeof item.imageUrl !== "string" ||
      (item.imageUrl.trim() && !safeImage.test(item.imageUrl.trim()))))
      return `${section}: la novedad ${index + 1} tiene una URL de imagen no permitida.`;
  }
  if (required !== "url") {
    const ids = value.map((item) => item.id);
    if (new Set(ids).size !== ids.length) return `${section}: hay identificadores duplicados.`;
  }
  return null;
}

function prepareSettings(value: unknown, current: SiteContentState): Result {
  if (!isRecord(value)) return { ok: false, error: "Configuración General: los ajustes no son válidos." };
  const next: Record<string, unknown> = { ...current.settings };

  for (const [key, input] of Object.entries(value)) {
    if (key === "featuredEventId") continue;
    if (!textSettingKeys.has(key) && key !== "contactItems" && key !== "socialItems" && key !== "garageNavVisible")
      return { ok: false, error: `Configuración General: el campo ${key} no existe.` };
    if (JSON.stringify(input) === JSON.stringify(next[key])) continue;

    if (key === "garageNavVisible") {
      if (typeof input !== "boolean") return { ok: false, error: "Configuración General: garageNavVisible debe ser verdadero o falso." };
      next[key] = input;
      continue;
    }

    if (key === "contactItems" || key === "socialItems") {
      if (!Array.isArray(input)) return { ok: false, error: `Configuración General: ${key} debe ser una lista.` };
      for (const [index, item] of input.entries()) {
        if (!isRecord(item) || typeof item.label !== "string" || typeof item.value !== "string")
          return { ok: false, error: `Configuración General: ${key}, fila ${index + 1}, necesita etiqueta y valor de texto.` };
      }
      next[key] = input;
      continue;
    }

    if (typeof input !== "string")
      return { ok: false, error: `Configuración General: ${key} debe ser texto.` };
    const text = input.trim();
    if (imageSettingKeys.has(key) && text && !safeImage.test(text))
      return { ok: false, error: `Configuración General: ${key} tiene una URL de imagen no permitida.` };
    if (linkSettingKeys.has(key) && text && !safeLink.test(text))
      return { ok: false, error: `Configuración General: ${key} tiene un enlace no permitido.` };
    next[key] = imageSettingKeys.has(key) || linkSettingKeys.has(key) ? text : input;
  }

  return { ok: true, changes: { settings: next as SiteSettings } };
}

export function prepareAdminSectionChanges(section: unknown, value: unknown, current: SiteContentState): Result {
  if (section === "settings") return prepareSettings(value, current);
  if (section === "about") {
    return typeof value === "string"
      ? { ok: true, changes: { quienes: value } }
      : { ok: false, error: "Información institucional: el texto debe ser válido." };
  }
  if (section === "nav") {
    const error = collection(value, current.content.navItems, "Menú", "label");
    return error ? { ok: false, error } : { ok: true, changes: { nav_items: value as NavItem[] } };
  }
  if (section === "news") {
    const error = collection(value, current.content.novedades, "Novedades", "title");
    return error ? { ok: false, error } : { ok: true, changes: { novedades: value as NewsItem[] } };
  }
  if (section === "photos") {
    const error = collection(value, current.content.fotos, "Galería", "url");
    return error ? { ok: false, error } : { ok: true, changes: { fotos: value as MotoPhoto[] } };
  }
  if (section === "events") {
    if (!isRecord(value) || !Array.isArray(value.events) || typeof value.featuredEventId !== "string")
      return { ok: false, error: "Eventos: el listado o el evento destacado no es válido." };
    const error = collection(value.events, current.content.events, "Eventos", "name");
    if (error) return { ok: false, error };
    const events = value.events as ClubEvent[];
    const visible = publishedEvents(events);
    const requestedId = events.length ? value.featuredEventId.trim() : "";
    if (requestedId && !visible.some((event) => event.id === requestedId))
      return { ok: false, error: "Eventos: el destacado debe tener nombre y estar publicado." };
    const featuredEventId = requestedId || visible[0]?.id || "";
    return {
      ok: true,
      changes: {
        events: featuredEventId
          ? [...events.filter((event) => event.id === featuredEventId), ...events.filter((event) => event.id !== featuredEventId)]
          : events,
        settings: { ...current.settings, featuredEventId },
      },
      featuredEventId,
    };
  }
  return { ok: false, error: "Sección de ADMIN no reconocida." };
}
