"use client";

import Image from "next/image";
import { MouseEvent, useEffect, useState } from "react";

const INTRO_SEEN_KEY = "motoclub-intro-seen";

export function IntroPresentation() {
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
    <section className="intro-presentation" aria-label="Presentacion de Moto Club Jujuy">
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
        <div className="intro-logo-shell">
          <span className="intro-logo-orbit" aria-hidden="true" />
          <Image
            className="intro-logo"
            src="/assets/logo-motoclub-intro.png"
            alt="Moto Club Jujuy Argentina"
            width={512}
            height={512}
            priority
          />
        </div>

        <a className="intro-enter-btn" href="#sitio" onClick={handleEnter}>
          Ingresar a la pagina
        </a>
      </div>
    </section>
  );
}
