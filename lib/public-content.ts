import type { ClubEvent, MotoPhoto, NewsItem } from "@/lib/site-data";

export function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function imageUrl(value: unknown): string | null {
  if (!hasText(value)) return null;
  const url = (value as string).trim();
  return /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp);base64,)/i.test(url) ? url : null;
}

export function publishedEvents(events: ClubEvent[]): ClubEvent[] {
  return events.filter((event) => event.published !== false && hasText(event.name));
}

export function publishedNews(items: NewsItem[]): NewsItem[] {
  return items.filter((item) => item.published !== false && hasText(item.title));
}

export function publishedPhotos(photos: MotoPhoto[]): MotoPhoto[] {
  return photos.filter((photo) => photo.published !== false && imageUrl(photo.url));
}
