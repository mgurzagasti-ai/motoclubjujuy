"use client";

import { useEffect, useState } from "react";
import { defaultContent, MotoclubContent, storageKey } from "@/lib/site-data";

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

export function useMotoclubContent() {
  const [content, setContent] = useState<MotoclubContent>(defaultContent);

  useEffect(() => {
    const syncFromStorage = () => {
      const storage = getBrowserStorage();
      const stored = storage?.getItem(storageKey);

      if (!stored) {
        setContent(defaultContent);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as Partial<MotoclubContent>;

        setContent({
          quienes: parsed.quienes || defaultContent.quienes,
          fotos: Array.isArray(parsed.fotos) ? parsed.fotos : defaultContent.fotos,
          events: Array.isArray(parsed.events) && parsed.events.length
            ? parsed.events
            : defaultContent.events,
        });
      } catch {
        setContent(defaultContent);
      }
    };

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const saveContent = (nextContent: MotoclubContent) => {
    setContent(nextContent);
    const storage = getBrowserStorage();
    storage?.setItem(storageKey, JSON.stringify(nextContent));
  };

  return {
    content,
    saveContent,
  };
}
