"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useRef, useState } from "react";
import type { MotoPhoto } from "@/lib/site-data";

type PhotoCarouselProps = {
  fotos: MotoPhoto[];
  onImageError?: (url: string) => void;
};

export function PhotoCarousel({ fotos, onImageError }: PhotoCarouselProps) {
  const carouselId = useId().replace(/:/g, "");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const zoomedPhoto = zoomedPhotoUrl === null ? null : fotos.find((foto) => foto.url === zoomedPhotoUrl);

  useEffect(() => {
    let instance: { dispose?: () => void } | undefined;

    const initCarousel = async () => {
      const Carousel = (await import("bootstrap/js/dist/carousel")).default;

      if (!carouselRef.current) {
        return;
      }

      instance = Carousel.getOrCreateInstance(carouselRef.current, {
        interval: 4000,
        ride: "carousel",
        touch: true,
        pause: "hover",
        wrap: true,
      });
    };

    void initCarousel();

    return () => {
      instance?.dispose?.();
    };
  }, [fotos.length]);

  if (!fotos.length) {
    return null;
  }

  return (
    <div className="motoclub-carousel-shell">
      <div
        id={carouselId}
        ref={carouselRef}
        className="carousel slide motoclub-carousel"
        data-bs-touch="true"
      >
        {fotos.length > 1 ? <div className="carousel-indicators">
          {fotos.map((foto, index) => (
            <button
              key={`${foto.url}-indicator-${index}`}
              type="button"
              data-bs-target={`#${carouselId}`}
              data-bs-slide-to={index}
              className={index === 0 ? "active" : ""}
              aria-current={index === 0 ? "true" : undefined}
              aria-label={`Ir a la imagen ${index + 1}`}
            />
          ))}
        </div> : null}

        <div className="carousel-inner">
          {fotos.map((foto, index) => (
            <div
              key={`${foto.url}-${index}`}
              className={`carousel-item ${index === 0 ? "active" : ""}`}
            >
              <button
                type="button"
                className="motoclub-carousel-frame"
                onClick={() => setZoomedPhotoUrl(foto.url)}
                aria-label={`Ampliar foto ${foto.titulo}`}
              >
                <img src={foto.url} alt={foto.titulo} loading="lazy" onError={() => onImageError?.(foto.url)} />
              </button>
              <div className="motoclub-carousel-caption">
                <strong>{foto.titulo}</strong>
                <span className="small">{foto.descripcion || ""}</span>
                <button
                  type="button"
                  className="day-zoom-btn"
                  onClick={() => setZoomedPhotoUrl(foto.url)}
                >
                  Ver mas grande
                </button>
              </div>
            </div>
          ))}
        </div>

        {fotos.length > 1 ? <button
          className="carousel-control-prev"
          type="button"
          data-bs-target={`#${carouselId}`}
          data-bs-slide="prev"
          aria-label="Imagen anterior"
        >
          <span className="motoclub-carousel-control" aria-hidden="true">
            ‹
          </span>
        </button> : null}

        {fotos.length > 1 ? <button
          className="carousel-control-next"
          type="button"
          data-bs-target={`#${carouselId}`}
          data-bs-slide="next"
          aria-label="Imagen siguiente"
        >
          <span className="motoclub-carousel-control" aria-hidden="true">
            ›
          </span>
        </button> : null}
      </div>

      {zoomedPhoto ? (
        <div
          className="event-zoom-backdrop"
          role="presentation"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div
            className="event-zoom-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-zoom-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="event-zoom-close"
              onClick={() => setZoomedPhotoUrl(null)}
              aria-label="Cerrar ampliacion de foto"
            >
              Cerrar
            </button>
            <div className="event-zoom-image">
              <img src={zoomedPhoto.url} alt={zoomedPhoto.titulo} loading="lazy" onError={() => onImageError?.(zoomedPhoto.url)} />
            </div>
            <div className="event-zoom-copy">
              <strong id="gallery-zoom-title">{zoomedPhoto.titulo}</strong>
              <p>{zoomedPhoto.descripcion || ""}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
