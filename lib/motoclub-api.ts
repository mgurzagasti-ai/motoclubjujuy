import {
  createDefaultEvent,
  createDefaultNewsItem,
  type ClubEvent,
  type MotoPhoto,
  type MotoclubContent,
  type NewsItem,
} from "@/lib/site-data";
import type { SiteContentState, SiteSettings } from "@/lib/site-content-store";

export type ApiEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  coverImage: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiGalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  caption: string;
  category: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiNewsItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiSiteContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  aboutText: string;
  contactText: string;
  featuredEventId: string;
  updatedAt: string;
};

type StoredClubEvent = ClubEvent & {
  date?: string;
  location?: string;
  coverImage?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StoredMotoPhoto = MotoPhoto & {
  id?: string;
  category?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StoredNewsItem = NewsItem & {
  slug?: string;
  summary?: string;
  content?: string;
  coverImage?: string;
  published?: boolean;
  updatedAt?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function getFeaturedEvent(content: MotoclubContent, settings: SiteSettings) {
  return (
    content.events.find((event) => event.id === settings.featuredEventId) ||
    content.events[0] ||
    createDefaultEvent()
  );
}

function fallbackEventDate(event: ClubEvent) {
  return event.badgeDate || event.dateMonth || "";
}

function fallbackEventLocation(event: ClubEvent) {
  return event.badgeLocation || event.contactItems[0]?.value || "";
}

function eventCoverImage(event: ClubEvent) {
  const storedEvent = event as StoredClubEvent;
  return storedEvent.coverImage || event.posterUrl || "";
}

export function toApiEvent(event: ClubEvent): ApiEvent {
  const storedEvent = event as StoredClubEvent;
  const timestamp = storedEvent.updatedAt || storedEvent.createdAt || nowIso();

  return {
    id: event.id,
    title: event.name,
    description: event.heroDescription || "",
    date: storedEvent.date || fallbackEventDate(event),
    location: storedEvent.location || fallbackEventLocation(event),
    coverImage: eventCoverImage(event),
    published: storedEvent.published ?? true,
    createdAt: storedEvent.createdAt || timestamp,
    updatedAt: storedEvent.updatedAt || timestamp,
  };
}

export function mergeApiEvent(current: ClubEvent | null, input: Partial<ApiEvent>): ClubEvent {
  const base = current ? ({ ...current } as StoredClubEvent) : ({ ...createDefaultEvent() } as StoredClubEvent);
  const nextId = current?.id || input.id || buildId("evt");
  const now = nowIso();
  const title = input.title?.trim() || base.name || "Nuevo evento";
  const description = input.description?.trim() ?? base.heroDescription ?? "";
  const date = input.date?.trim() ?? base.date ?? fallbackEventDate(base);
  const location = input.location?.trim() ?? base.location ?? fallbackEventLocation(base);
  const coverImage = input.coverImage?.trim() ?? base.coverImage ?? base.posterUrl ?? "";

  return {
    ...base,
    id: nextId,
    name: title,
    heroEyebrow: base.heroEyebrow || "Evento del club",
    heroHeadlinePrefix: base.heroHeadlinePrefix || "Rodamos hacia",
    heroHeadlineHighlight: title,
    heroDescription: description,
    summaryEyebrow: base.summaryEyebrow || "Proximo evento",
    summaryTitlePrefix: base.summaryTitlePrefix || "Nueva salida,",
    summaryTitleHighlight: base.summaryTitleHighlight || "misma pasion",
    sectionTitlePrefix: base.sectionTitlePrefix || title,
    sectionTitleHighlight: base.sectionTitleHighlight || "",
    badgeDate: date || base.badgeDate,
    badgeLocation: location || base.badgeLocation,
    dateNumbers: base.dateNumbers || "",
    dateMonth: date || base.dateMonth,
    posterUrl: coverImage,
    posterAlt: base.posterAlt || title,
    metaItems: base.metaItems,
    highlightItems: base.highlightItems,
    dayItems: base.dayItems,
    socialItems: base.socialItems,
    contactItems: base.contactItems?.length
      ? base.contactItems
      : [{ label: "Ubicacion", value: location || "Por definir" }],
    registrationTitle: base.registrationTitle,
    registrationDescription: base.registrationDescription,
    registrationHref: base.registrationHref,
    registrationLabel: base.registrationLabel,
    date,
    location,
    coverImage,
    published: input.published ?? base.published ?? true,
    createdAt: base.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

function fallbackGalleryId(photo: StoredMotoPhoto, index: number) {
  return photo.id || photo.publicId || slugify(photo.url || photo.titulo || `photo-${index}`) || `gal-${index}`;
}

export function toApiGalleryItem(photo: MotoPhoto, index: number): ApiGalleryItem {
  const storedPhoto = photo as StoredMotoPhoto;
  const timestamp = storedPhoto.updatedAt || storedPhoto.createdAt || nowIso();

  return {
    id: fallbackGalleryId(storedPhoto, index),
    title: storedPhoto.titulo || "Nueva imagen",
    imageUrl: storedPhoto.url || "",
    caption: storedPhoto.descripcion || "",
    category: storedPhoto.category || "general",
    published: storedPhoto.published ?? true,
    createdAt: storedPhoto.createdAt || timestamp,
    updatedAt: storedPhoto.updatedAt || timestamp,
  };
}

export function mergeApiGalleryItem(current: MotoPhoto | null, input: Partial<ApiGalleryItem>): MotoPhoto {
  const base = current ? ({ ...current } as StoredMotoPhoto) : ({} as StoredMotoPhoto);
  const now = nowIso();

  return {
    ...base,
    id: base.id || input.id || buildId("gal"),
    url: input.imageUrl?.trim() ?? base.url ?? "",
    titulo: input.title?.trim() || base.titulo || "Nueva imagen",
    descripcion: input.caption?.trim() ?? base.descripcion ?? "",
    publicId: base.publicId,
    category: input.category?.trim() || base.category || "general",
    published: input.published ?? base.published ?? true,
    createdAt: base.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

export function toApiNewsItem(item: NewsItem): ApiNewsItem {
  const storedItem = item as StoredNewsItem;
  const title = item.title || "Nueva novedad";
  const timestamp = storedItem.updatedAt || item.createdAt || nowIso();

  return {
    id: item.id,
    title,
    slug: storedItem.slug || slugify(title) || item.id,
    summary: storedItem.summary || item.description || "",
    content: storedItem.content || item.description || "",
    coverImage: storedItem.coverImage || item.imageUrl || "",
    published: storedItem.published ?? true,
    createdAt: item.createdAt || timestamp,
    updatedAt: storedItem.updatedAt || timestamp,
  };
}

export function mergeApiNewsItem(current: NewsItem | null, input: Partial<ApiNewsItem>): NewsItem {
  const base = current ? ({ ...current } as StoredNewsItem) : ({ ...createDefaultNewsItem() } as StoredNewsItem);
  const now = nowIso();
  const title = input.title?.trim() || base.title || "Nueva novedad";
  const content = input.content?.trim() ?? base.content ?? base.description ?? "";
  const summary = input.summary?.trim() ?? base.summary ?? base.description ?? "";
  const coverImage = input.coverImage?.trim() ?? base.coverImage ?? base.imageUrl ?? "";

  return {
    ...base,
    id: current?.id || input.id || buildId("news"),
    title,
    slug: input.slug?.trim() || base.slug || slugify(title) || buildId("news"),
    summary,
    content,
    coverImage,
    description: summary,
    imageUrl: coverImage,
    imageAlt: base.imageAlt || title,
    published: input.published ?? base.published ?? true,
    createdAt: base.createdAt || input.createdAt || now,
    updatedAt: now,
    tag: base.tag || "Novedad",
    date: base.date || "",
  };
}

export function toApiSiteContent(state: SiteContentState): ApiSiteContent {
  const featured = getFeaturedEvent(state.content, state.settings);

  return {
    heroTitle: state.settings.heroTitle || featured.name || "Moto Club Jujuy",
    heroSubtitle: state.settings.heroSubtitle || featured.heroEyebrow || "",
    heroImage: state.settings.heroImage || eventCoverImage(featured) || state.content.fotos[0]?.url || "",
    aboutText: state.content.quienes || "",
    contactText: state.settings.contactText || "",
    featuredEventId: state.settings.featuredEventId || featured.id || "",
    updatedAt: state.updatedAt || nowIso(),
  };
}

export function mergeApiSiteContent(state: SiteContentState, input: Partial<ApiSiteContent>): SiteContentState {
  const content = { ...state.content };
  const settings = { ...state.settings };
  const targetEventId =
    input.featuredEventId?.trim() || settings.featuredEventId || content.events[0]?.id || createDefaultEvent().id;

  if (input.aboutText !== undefined) {
    content.quienes = input.aboutText;
  }

  if (input.heroTitle !== undefined) {
    settings.heroTitle = input.heroTitle.trim();
  }

  if (input.heroSubtitle !== undefined) {
    settings.heroSubtitle = input.heroSubtitle.trim();
  }

  if (input.heroImage !== undefined) {
    settings.heroImage = input.heroImage.trim();
  }

  if (input.contactText !== undefined) {
    settings.contactText = input.contactText.trim();
  }

  settings.featuredEventId = targetEventId;

  if (!content.events.some((event) => event.id === targetEventId)) {
    content.events = [...content.events, mergeApiEvent(null, { id: targetEventId, title: settings.heroTitle })];
  }

  return {
    content,
    settings,
    updatedAt: state.updatedAt,
  };
}
