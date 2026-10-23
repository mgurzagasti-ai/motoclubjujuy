"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { publishedEvents } from "@/lib/public-content";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

const visitStorageKey = "motoclub_visit_count";
const visitSessionKey = "motoclub_visit_session_counted";
const counterSlug = "home";

function buildSocialHref(label: string, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmedValue)) {
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

  if (normalizedLabel.includes("correo") || normalizedLabel.includes("email")) {
    return trimmedValue.includes("@") ? `mailto:${trimmedValue}` : null;
  }

  if (normalizedLabel.includes("teléfono") || normalizedLabel.includes("telefono") || normalizedLabel.includes("celular")) {
    const phone = trimmedValue.replace(/[^\d+]/g, "");
    return phone ? `tel:${phone}` : null;
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

function getSocialIconAsset(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("instagram")) {
    return {
      src: "/assets/instagram-logo.avif",
      alt: "Logo de Instagram",
    };
  }

  if (normalizedLabel.includes("facebook")) {
    return {
      src: "/assets/facebook-logo.png",
      alt: "Logo de Facebook",
    };
  }

  if (normalizedLabel.includes("whatsapp")) {
    return {
      src: "/assets/whatsapp-logo.svg",
      alt: "Logo de WhatsApp",
    };
  }

  return null;
}

export function Footer() {
  const { content, featuredEventId, siteSettings, contentReady } = useMotoclubContent();
  const [visitCount, setVisitCount] = useState(0);
  const [counterSource, setCounterSource] = useState<"supabase" | "local">("local");
  const visibleEvents = publishedEvents(content.events);
  const featuredEvent =
    visibleEvents.find((event) => event.id === featuredEventId) ?? visibleEvents[0] ?? null;

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

  const socialLinks = useMemo(() => {
    const links = (siteSettings.socialItems ?? featuredEvent?.socialItems ?? [])
      .map((item) => ({
        ...item,
        href: buildSocialHref(item.label, item.value),
        icon: getSocialIcon(item.label),
      }))
      .filter((item) => Boolean(item.href));

    const hasWhatsapp = links.some((item) => item.label.toLowerCase().includes("whatsapp"));
    const registrationHref = featuredEvent?.registrationHref?.trim() || "";
    const isWhatsappRegistration =
      /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(registrationHref);

    if (!hasWhatsapp && isWhatsappRegistration) {
      links.push({
        label: "WhatsApp",
        value: registrationHref,
        href: registrationHref,
        icon: getSocialIcon("whatsapp"),
      });
    }

    return links;
  }, [featuredEvent?.registrationHref, featuredEvent?.socialItems, siteSettings.socialItems]);
  const contactTitle = siteSettings.footerContactTitle ?? "Seguinos y escribinos";
  const contactText = siteSettings.footerContactText ?? "Encontranos en redes y mantenete al tanto de las novedades del club.";
  const credit = siteSettings.footerCredit ?? "Martin Urzagasti";

  if (!contentReady) {
    return null;
  }

  return (
    <footer className="site-footer" id="footer">
      <div className="footer-card">
        <div className="footer-top">
          <div className="footer-brand-block">
            {siteSettings.clubName !== "" ? <span className="footer-eyebrow">{siteSettings.clubName ?? "Moto Club Jujuy"}</span> : null}
            {siteSettings.clubTagline !== "" ? <strong>{siteSettings.clubTagline ?? "Comunidad, ruta y encuentros con identidad jujeña"}</strong> : null}
            {siteSettings.footerDescription !== "" ? <p>{siteSettings.footerDescription ?? "Pasion por las dos ruedas, nuevas rutas y una comunidad abierta a todos los motociclistas."}</p> : null}
          </div>

          <div className="footer-counter">
            <span className="footer-counter-label">Visitas registradas</span>
            <strong>{visitCount}</strong>
            <p className="footer-helper">
              Fuente actual: {counterSource === "supabase" ? "Supabase global" : "Contador local"}
            </p>
          </div>
        </div>

        {(contactTitle.trim() || contactText.trim() || socialLinks.length > 0) ? <div className="footer-bottom">
          <div className="footer-copy">
            {contactTitle.trim() ? <strong>{contactTitle}</strong> : null}
            {contactText.trim() ? <p>{contactText}</p> : null}
          </div>

          <div className="footer-socials">
            {socialLinks.map((item, index) => {
              const iconAsset = getSocialIconAsset(item.label);

              return (
                <a
                  key={`${item.label}-${index}`}
                  className="footer-social-link"
                  href={item.href ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  title={`${item.label}: ${item.value}`}
                >
                  {iconAsset ? (
                    <span className="footer-social-icon footer-social-icon--image" aria-hidden="true">
                      <Image src={iconAsset.src} alt={iconAsset.alt} width={32} height={32} />
                    </span>
                  ) : (
                    <span className="footer-social-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </div> : null}

        <div className="footer-legal">
          {siteSettings.footerLegal !== "" ? <span>{siteSettings.footerLegal ?? "Pasion por las dos ruedas (c) 2026"}</span> : null}
          {credit.trim() ? <span>{credit}</span> : null}
        </div>
      </div>
    </footer>
  );
}
