"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

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
  const navLinks = useMemo(
    () =>
      (contentReady ? content.navItems : []).filter((item) => item.visible !== false).map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
        sectionId: getSectionIdFromHref(item.href),
        isExternal: isExternalHref(item.href),
        accent: item.id === "nav-contacto",
      })),
    [content.navItems, contentReady]
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
      <Link className="brand" href="/#inicio">
        <span className="brand-logo-shell">
          <Image
            className="brand-logo"
            src={siteSettings.logoUrl || "/assets/logo-motoclub-intro.png"}
            alt={`Logo de ${siteSettings.clubName || "Moto Club Jujuy"}`}
            width={58}
            height={58}
            priority
            unoptimized
          />
        </span>
        <div className="brand-copy">
          <strong>{siteSettings.clubName || "Moto Club Jujuy"}</strong>
          <span>{siteSettings.clubTagline || "@motoclubjujuy.oficial"}</span>
        </div>
      </Link>

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
      </div>
    </nav>
  );
}
