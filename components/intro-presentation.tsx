"use client";

import Image from "next/image";
import { MouseEvent, useEffect, useState } from "react";
import { useMotoclubContent } from "@/lib/use-motoclub-content";
import { imageUrl } from "@/lib/public-content";

const INTRO_SEEN_KEY = "motoclub-intro-seen";

export function IntroPresentation() {
  const { siteSettings } = useMotoclubContent();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = imageUrl(siteSettings.logoUrl === undefined ? "/assets/logo-motoclub-intro.png" : siteSettings.logoUrl);
  const [isDismissed, setIsDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(INTRO_SEEN_KEY) === "true"
  );

  useEffect(() => {
    if (isDismissed) {
      document.body.classList.remove("has-intro-presentation");
      return;
    }

    document.body.classList.add("has-intro-presentation");

    return () => {
      document.body.classList.remove("has-intro-presentation");
    };
  }, [isDismissed]);

  const handleEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "true");
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <section className="intro-presentation" aria-label={`Presentacion de ${siteSettings.clubName || "Moto Club Jujuy"}`}>
      <div className="intro-video-layer" aria-hidden="true">
        <div className="intro-road intro-road--one" />
        <div className="intro-road intro-road--two" />
        <div className="intro-road intro-road--three" />
        <div className="intro-bike">
          <span className="intro-bike-body" />
          <span className="intro-bike-wheel intro-bike-wheel--front" />
          <span className="intro-bike-wheel intro-bike-wheel--back" />
        </div>
        <div className="intro-speed-lines" />
      </div>

      <div className="intro-vignette" aria-hidden="true" />

      <div className="intro-content">
        {logoUrl && failedLogoUrl !== logoUrl ? <div className="intro-logo-shell">
          <span className="intro-logo-orbit" aria-hidden="true" />
          <Image
            className="intro-logo"
            src={logoUrl}
            alt={siteSettings.clubName || "Moto Club Jujuy Argentina"}
            width={512}
            height={512}
            priority
            unoptimized
            onError={() => setFailedLogoUrl(logoUrl)}
          />
        </div> : null}

        <a className="intro-enter-btn" href="#sitio" onClick={handleEnter}>
          {siteSettings.introButtonLabel || "Ingresar a la pagina"}
        </a>
      </div>
    </section>
  );
}
