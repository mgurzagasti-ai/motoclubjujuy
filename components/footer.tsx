"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultContent } from "@/lib/site-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

const visitStorageKey = "motoclub_visit_count";
const visitSessionKey = "motoclub_visit_session_counted";
const counterSlug = "home";

function buildSocialHref(label: string, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedLabel = label.trim().toLowerCase();
  const normalizedValue = trimmedValue.replace(/^@/, "");

  if (normalizedLabel.includes("instagram")) {
    return `https://www.instagram.com/${normalizedValue}/`;
  }

  if (normalizedLabel.includes("facebook")) {
    return `https://www.facebook.com/${normalizedValue}`;
  }

  if (normalizedLabel.includes("whatsapp")) {
    const phone = normalizedValue.replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}` : null;
  }

  if (normalizedLabel.includes("youtube")) {
    return normalizedValue.startsWith("@")
      ? `https://www.youtube.com/${normalizedValue}`
      : `https://www.youtube.com/@${normalizedValue}`;
  }

  if (normalizedLabel.includes("x") || normalizedLabel.includes("twitter")) {
    return `https://x.com/${normalizedValue}`;
  }

  return null;
}

function getSocialIcon(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("instagram")) {
    return "IG";
  }

  if (normalizedLabel.includes("facebook")) {
    return "FB";
  }

  if (normalizedLabel.includes("whatsapp")) {
    return "WA";
  }

  if (normalizedLabel.includes("youtube")) {
    return "YT";
  }

  if (normalizedLabel.includes("x") || normalizedLabel.includes("twitter")) {
    return "X";
  }

  return "#";
}

export function Footer() {
  const { content } = useMotoclubContent();
  const [visitCount, setVisitCount] = useState(0);
  const [counterSource, setCounterSource] = useState<"supabase" | "local">("local");
  const featuredEvent = content.events[0] ?? defaultContent.events[0];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyLocalCounter = () => {
      const currentCount = Number(window.localStorage.getItem(visitStorageKey) || "0");
      const alreadyCounted = window.sessionStorage.getItem(visitSessionKey) === "true";

      if (alreadyCounted) {
        setVisitCount(currentCount);
        setCounterSource("local");
        return;
      }

      const nextCount = currentCount + 1;
      window.localStorage.setItem(visitStorageKey, String(nextCount));
      window.sessionStorage.setItem(visitSessionKey, "true");
      setVisitCount(nextCount);
      setCounterSource("local");
    };

    const syncSupabaseCounter = async () => {
      if (!hasSupabaseConfig() || !supabase) {
        applyLocalCounter();
        return;
      }

      try {
        const alreadyCounted = window.sessionStorage.getItem(visitSessionKey) === "true";

        if (alreadyCounted) {
          const { data, error } = await supabase
            .from("page_counters")
            .select("total_visits")
            .eq("slug", counterSlug)
            .single();

          if (error) {
            throw error;
          }

          setVisitCount(Number(data.total_visits || 0));
          setCounterSource("supabase");
          return;
        }

        const { data, error } = await supabase.rpc("increment_page_visits", {
          page_slug: counterSlug,
        });

        if (error) {
          throw error;
        }

        window.sessionStorage.setItem(visitSessionKey, "true");
        setVisitCount(Number(data || 0));
        setCounterSource("supabase");
      } catch {
        applyLocalCounter();
      }
    };

    void syncSupabaseCounter();
  }, []);

  const socialLinks = useMemo(
    () =>
      featuredEvent.socialItems
        .map((item) => ({
          ...item,
          href: buildSocialHref(item.label, item.value),
          icon: getSocialIcon(item.label),
        }))
        .filter((item) => Boolean(item.href)),
    [featuredEvent.socialItems]
  );

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-block">
          <strong>Moto Club Jujuy</strong>
          <p>Pasion por las dos ruedas © 2026 - Martin Urzagasti</p>
        </div>

        <div className="footer-block">
          <strong>Contador de visitas</strong>
          <p>Visitas registradas: {visitCount}</p>
          <p className="footer-helper">
            Fuente actual: {counterSource === "supabase" ? "Supabase global" : "Contador local"}
          </p>
        </div>

        <div className="footer-block">
          <strong>Seguinos en las redes sociales</strong>
          <div className="footer-socials">
            {socialLinks.map((item, index) => (
              <a
                key={`${item.label}-${index}`}
                className="footer-social-link"
                href={item.href ?? "#"}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                title={`${item.label}: ${item.value}`}
              >
                <span className="footer-social-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
