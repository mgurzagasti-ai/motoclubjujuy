"use client";

import { useEffect, useRef, useState } from "react";
import { defaultContent, MotoclubContent, normalizeContent, storageKey } from "@/lib/site-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/site-settings";

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window.localStorage;

  if (
    !candidate ||
    typeof candidate.getItem !== "function" ||
    typeof candidate.setItem !== "function"
  ) {
    return null;
  }

  return candidate;
}

const emptyContent: MotoclubContent = {
  navItems: [],
  quienes: "",
  fotos: [],
  events: [],
  novedades: [],
};

function readStoredContent(useExamplesWhenMissing = true): MotoclubContent {
  const storage = getBrowserStorage();
  const stored = storage?.getItem(storageKey);

  if (!stored) {
    return useExamplesWhenMissing ? defaultContent : emptyContent;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MotoclubContent>;
    return normalizeContent(parsed);
  } catch {
    return useExamplesWhenMissing ? defaultContent : emptyContent;
  }
}

function readStoredPhotos(): MotoclubContent["fotos"] {
  const stored = getBrowserStorage()?.getItem(storageKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MotoclubContent>;
    return Array.isArray(parsed.fotos) ? parsed.fotos : [];
  } catch {
    return [];
  }
}

export function useMotoclubContent() {
  const [content, setContent] = useState<MotoclubContent>(defaultContent);
  const [contentReady, setContentReady] = useState(!hasSupabaseConfig());
  const [featuredEventId, setFeaturedEventId] = useState(defaultContent.events[0]?.id ?? "");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [cloudinaryEnabled, setCloudinaryEnabled] = useState(false);
  const cloudinaryEnabledRef = useRef(false);
  const contentVersionRef = useRef<string | null | undefined>(undefined);
  const refreshSequenceRef = useRef(0);
  const [contentSource, setContentSource] = useState<"local" | "supabase">("local");

  const refreshSupabaseContent = async () => {
    const requestId = ++refreshSequenceRef.current;
    if (!hasSupabaseConfig() || !supabase) {
      return null;
    }

    try {
      let { data, error } = await supabase
        .from("site_content")
        .select("nav_items, quienes, fotos, events, novedades, settings, updated_at")
        .eq("slug", "main")
        .maybeSingle();

      if (
        error &&
        (error.code === "42703" ||
          error.code === "PGRST204" ||
          error.message?.toLowerCase().includes("settings"))
      ) {
        const fallback = await supabase
          .from("site_content")
          .select("nav_items, quienes, fotos, events, novedades, updated_at")
          .eq("slug", "main")
          .maybeSingle();
        data = fallback.data ? { ...fallback.data, settings: null } : null;
        error = fallback.error;
      }

      if (error) {
        throw error;
      }

      if (requestId !== refreshSequenceRef.current) {
        return null;
      }

      const nextContent = normalizeContent(
        data
          ? {
              navItems: data.nav_items,
              quienes: data.quienes,
              fotos: data.fotos,
              events: data.events,
              novedades: data.novedades,
            }
          : null
      );
      const updatedAt = data?.updated_at ?? null;
      const settings = data?.settings as SiteSettings | null | undefined;
      setSiteSettings(settings || {});
      const nextFeaturedEventId =
        typeof settings?.featuredEventId === "string" &&
        nextContent.events.some((event) => event.id === settings.featuredEventId && event.published !== false)
          ? settings.featuredEventId
          : nextContent.events.find((event) => event.published !== false)?.id ?? "";

      contentVersionRef.current = updatedAt;
      setContent(nextContent);
      setFeaturedEventId(nextFeaturedEventId);
      setContentSource("supabase");
      setContentReady(true);
      return { content: nextContent, updatedAt, featuredEventId: nextFeaturedEventId, settings: settings || {} };
    } catch {
      if (requestId === refreshSequenceRef.current) {
        const localContent = readStoredContent(false);
        setContent(localContent);
        setFeaturedEventId(localContent.events.find((event) => event.published !== false)?.id ?? "");
        setContentSource("local");
        setContentReady(true);
      }
      return null;
    }
  };

  const refreshPhotos = async () => {
    try {
      const response = await fetch("/api/photos", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudo obtener la galeria.");
      }

      const payload = (await response.json()) as {
        enabled?: boolean;
        photos?: MotoclubContent["fotos"];
      };

      const enabled = Boolean(payload.enabled);
      cloudinaryEnabledRef.current = enabled;
      setCloudinaryEnabled(enabled);

      if (!hasSupabaseConfig() || !supabase) {
        if (!enabled) {
          const localContent = readStoredContent();
          setContent((current) => ({
            ...current,
            fotos: localContent.fotos,
          }));
          return;
        }

        const localPhotos = readStoredPhotos();
        setContent((current) => ({
          ...current,
          fotos: [
            ...localPhotos,
            ...(payload.photos || []).filter(
              (photo) => !localPhotos.some((stored) => stored.url === photo.url)
            ),
          ],
        }));
        return;
      }

      if (!enabled) {
        return;
      }
    } catch {
      cloudinaryEnabledRef.current = false;
      setCloudinaryEnabled(false);
      if (!hasSupabaseConfig() || !supabase) {
        const localContent = readStoredContent();
        setContent((current) => ({
          ...current,
          fotos: localContent.fotos,
        }));
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const syncFromStorage = () => {
      if (hasSupabaseConfig()) {
        return;
      }

      const localContent = readStoredContent();

      setContent((current) => ({
        navItems: localContent.navItems,
        quienes: localContent.quienes,
        events: localContent.events,
        novedades: localContent.novedades,
        fotos: current.fotos.length ? current.fotos : localContent.fotos,
      }));
      setFeaturedEventId(localContent.events.find((event) => event.published !== false)?.id ?? "");
      setContentSource("local");
    };

    syncFromStorage();
    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      void refreshSupabaseContent();
      void refreshPhotos();
    });
    window.addEventListener("storage", syncFromStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const saveContent = (nextContent: MotoclubContent, updatedAt?: string | null, settings?: SiteSettings) => {
    refreshSequenceRef.current += 1;
    if (updatedAt !== undefined) {
      contentVersionRef.current = updatedAt;
    }

    const localSnapshot = {
      navItems: nextContent.navItems,
      quienes: nextContent.quienes,
      events: nextContent.events,
      novedades: nextContent.novedades,
      fotos: nextContent.fotos,
    };

    setContent({
      navItems: nextContent.navItems,
      quienes: nextContent.quienes,
      events: nextContent.events,
      novedades: nextContent.novedades,
      fotos: nextContent.fotos,
    });
    setFeaturedEventId(nextContent.events[0]?.id ?? "");
    if (settings) setSiteSettings(settings);
    setContentReady(true);

    const storage = getBrowserStorage();
    try {
      storage?.setItem(storageKey, JSON.stringify(localSnapshot));
    } catch {
      // The server save succeeded even if the local cache is full or unavailable.
    }
  };

  return {
    content,
    contentReady,
    featuredEventId,
    siteSettings,
    setFeaturedEventId,
    saveContent,
    getContentVersion: () => contentVersionRef.current,
    cloudinaryEnabled,
    refreshPhotos,
    refreshSupabaseContent,
    contentSource,
  };
}
