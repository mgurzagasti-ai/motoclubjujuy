"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { defaultContent } from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

function getSectionIdFromHref(href: string) {
  const match = href.match(/#(.+)$/);
  return match?.[1] ?? null;
}

export function Navbar() {
  const { content } = useMotoclubContent();
  const navItems = content.navItems.length ? content.navItems : defaultContent.navItems;
  const [activeSection, setActiveSection] = useState("inicio");
  const navLinks = useMemo(
    () => [
      ...navItems.map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label,
        sectionId: getSectionIdFromHref(item.href),
        accent: false,
      })),
      {
        id: "nav-contacto",
        href: "/#footer",
        label: "Contacto",
        sectionId: "footer",
        accent: true,
      },
    ],
    [navItems]
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

  return (
    <nav className="navbar">
      <Link className="brand" href="/#inicio">
        <Image
          src="/assets/logo-motoclub.jpeg"
          alt="Logo de Moto Club Jujuy"
          width={58}
          height={58}
          priority
        />
        <div className="brand-copy">
          <strong>Moto Club Jujuy</strong>
          <span>@motoclubjujuy.oficial</span>
        </div>
      </Link>

      <div className="nav-links">
        {navLinks.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`${item.accent ? "nav-link-accent" : ""} ${
              item.sectionId === activeSection ? "is-active" : ""
            }`.trim()}
            aria-current={item.sectionId === activeSection ? "page" : undefined}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
