"use client";

import { useEffect, useRef, useState } from "react";
import { defaultContent, MotoclubContent, normalizeContent, storageKey } from "@/lib/site-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

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

function readStoredContent(): MotoclubContent {
  const storage = getBrowserStorage();
  const stored = storage?.getItem(storageKey);

  if (!stored) {
    return defaultContent;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MotoclubContent>;
    return normalizeContent(parsed);
  } catch {
    return defaultContent;
  }
}

export function useMotoclubContent() {
  const [content, setContent] = useState<MotoclubContent>(defaultContent);
  const [cloudinaryEnabled, setCloudinaryEnabled] = useState(false);
  const cloudinaryEnabledRef = useRef(false);
  const [contentSource, setContentSource] = useState<"local" | "supabase">("local");

  const refreshSupabaseContent = async () => {
    if (!hasSupabaseConfig() || !supabase) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("site_content")
        .select("quienes, events, novedades")
        .eq("slug", "main")
        .single();

      if (error || !data) {
        throw error;
      }

      const nextContent = normalizeContent({
        quienes: data.quienes,
        events: data.events,
        novedades: data.novedades,
        fotos: readStoredContent().fotos,
      });

      setContent((current) => ({
        ...current,
        quienes: nextContent.quienes,
        events: nextContent.events,
        novedades: nextContent.novedades,
      }));
      setContentSource("supabase");
      return true;
    } catch {
      setContentSource("local");
      return false;
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

      if (!enabled) {
        const localContent = readStoredContent();
        setContent((current) => ({
          ...current,
          fotos: localContent.fotos,
        }));
        return;
      }

      setContent((current) => ({
        ...current,
        fotos: [...defaultContent.fotos, ...(payload.photos || [])],
      }));
    } catch {
      const localContent = readStoredContent();
      cloudinaryEnabledRef.current = false;
      setCloudinaryEnabled(false);
      setContent((current) => ({
        ...current,
        fotos: localContent.fotos,
      }));
    }
  };

  useEffect(() => {
    const syncFromStorage = () => {
      const localContent = readStoredContent();

      setContent((current) => ({
        quienes: localContent.quienes,
        events: localContent.events,
        novedades: localContent.novedades,
        fotos: cloudinaryEnabledRef.current ? current.fotos : localContent.fotos,
      }));
      setContentSource("local");
    };

    syncFromStorage();
    void refreshSupabaseContent();
    void refreshPhotos();
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const saveContent = (nextContent: MotoclubContent) => {
    const localSnapshot = {
      quienes: nextContent.quienes,
      events: nextContent.events,
      novedades: nextContent.novedades,
      fotos: cloudinaryEnabledRef.current ? [] : nextContent.fotos,
    };

    setContent((current) => ({
      quienes: nextContent.quienes,
      events: nextContent.events,
      novedades: nextContent.novedades,
      fotos: cloudinaryEnabledRef.current ? current.fotos : nextContent.fotos,
    }));

    const storage = getBrowserStorage();
    storage?.setItem(storageKey, JSON.stringify(localSnapshot));
  };

  return {
    content,
    saveContent,
    cloudinaryEnabled,
    refreshPhotos,
    refreshSupabaseContent,
    contentSource,
  };
}
