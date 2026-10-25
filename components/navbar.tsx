"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMotoclubContent } from "@/lib/use-motoclub-content";
import { imageUrl } from "@/lib/public-content";

function getSectionIdFromHref(href: string) {
  const match = href.match(/#(.+)$/);
  return match?.[1] ?? null;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function Navbar() {
  const { content, siteSettings, contentReady } = useMotoclubContent();
  const [activeSection, setActiveSection] = useState("inicio");
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = imageUrl(siteSettings.logoUrl === undefined ? "/assets/logo-motoclub-intro.png" : siteSettings.logoUrl);
  const clubName = siteSettings.clubName ?? "Moto Club Jujuy";
  const clubTagline = siteSettings.clubTagline ?? "@motoclubjujuy.oficial";
  const navLinks = useMemo(
    () =>
      (contentReady ? content.navItems : []).filter((item) => item.visible !== false && item.label.trim() && item.href.trim() &&
        (item.href !== "/garage" || siteSettings.garageNavVisible !== false)).map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
        sectionId: getSectionIdFromHref(item.href),
        isExternal: isExternalHref(item.href),
        accent: item.id === "nav-contacto",
      })),
    [content.navItems, contentReady, siteSettings.garageNavVisible]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateActiveSection = () => {
      const sections = navLinks
        .map((item) => item.sectionId)
        .filter((value): value is string => Boolean(value))
        .map((sectionId) => document.getElementById(sectionId))
        .filter((section): section is HTMLElement => Boolean(section));

      const threshold = 140;
      const currentSection = sections
        .filter((section) => section.getBoundingClientRect().top <= threshold)
        .at(-1);

      if (currentSection?.id) {
        setActiveSection(currentSection.id);
        return;
      }

      const hashSection = window.location.hash.replace("#", "");
      if (hashSection) {
        setActiveSection(hashSection);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("hashchange", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("hashchange", updateActiveSection);
    };
  }, [navLinks]);

  if (!contentReady) {
    return <nav className="navbar" />;
  }

  return (
    <nav className="navbar">
      {(logoUrl || clubName.trim() || clubTagline.trim()) ? <Link className="brand" href="/#inicio">
        {logoUrl && failedLogoUrl !== logoUrl ? <span className="brand-logo-shell">
          <Image
            className="brand-logo"
            src={logoUrl}
            alt={`Logo de ${clubName}`}
            width={58}
            height={58}
            priority
            unoptimized
            onError={() => setFailedLogoUrl(logoUrl)}
          />
        </span> : null}
        {(clubName.trim() || clubTagline.trim()) ? <div className="brand-copy">
          {clubName.trim() ? <strong>{clubName}</strong> : null}
          {clubTagline.trim() ? <span>{clubTagline}</span> : null}
        </div> : null}
      </Link> : null}

      <div className="nav-links">
        {navLinks.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            target={item.isExternal ? "_blank" : undefined}
            rel={item.isExternal ? "noreferrer" : undefined}
            className={`${item.accent ? "nav-link-accent" : ""} ${
              !item.isExternal && item.sectionId === activeSection ? "is-active" : ""
            }`.trim()}
            aria-current={!item.isExternal && item.sectionId === activeSection ? "page" : undefined}
          >
            <span>{item.label}</span>
          </Link>
        ))}
        {siteSettings.garageNavVisible !== false && !content.navItems.some((item) => item.href === "/garage")
          ? <Link href="/garage" className="nav-link">Garage</Link> : null}
      </div>
    </nav>
  );
}
