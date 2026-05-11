"use client";

import Image from "next/image";
import { PhotoCarousel } from "@/components/photo-carousel";
import { defaultContent } from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

export function PublicSections() {
  const { content } = useMotoclubContent();
  const featuredEvent = content.events[0] ?? defaultContent.events[0];
  const extraEvents = content.events.slice(1);

  return (
    <>
      <section id="inicio" className="page active-page">
        <div className="hero">
          <div className="hero-copy">
            <div className="eyebrow">{featuredEvent.heroEyebrow}</div>
            <h1>
              {featuredEvent.heroHeadlinePrefix} <span>{featuredEvent.heroHeadlineHighlight}</span>
            </h1>
            <p>{featuredEvent.heroDescription}</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#evento">
                Ver evento
              </a>
              <a className="btn btn-secondary" href="#quienes">
                Conocer el club
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <Image
              src={featuredEvent.posterUrl}
              alt={featuredEvent.posterAlt}
              width={900}
              height={900}
              className="poster-image"
              priority
            />
            <div className="hero-badge">
              <strong>{featuredEvent.badgeDate}</strong>
              <span>{featuredEvent.badgeLocation}</span>
            </div>
          </div>
        </div>

        <div className="section-block event-grid">
          <article className="panel">
            <div className="event-headline">
              <div>
                <div className="eyebrow">{featuredEvent.summaryEyebrow}</div>
                <h2 className="section-title">
                  {featuredEvent.summaryTitlePrefix}{" "}
                  <span>{featuredEvent.summaryTitleHighlight}</span>
                </h2>
              </div>
              <div className="event-date">
                <strong>{featuredEvent.dateNumbers}</strong>
                <span>{featuredEvent.dateMonth}</span>
              </div>
            </div>

            <div className="event-meta">
              {featuredEvent.metaItems.map((item, index) => (
                <div className="meta-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <aside className="panel">
            <div className="highlights">
              {featuredEvent.highlightItems.map((item, index) => (
                <div className="highlight-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section id="evento" className="page active-page">
        <h2 className="section-title">
          <span>{featuredEvent.sectionTitlePrefix}</span> {featuredEvent.sectionTitleHighlight}
        </h2>
        <div className="event-grid">
          <article className="panel">
            <div className="day-list">
              {featuredEvent.dayItems.map((item, index) => (
                <div className="day-item" key={`${item.day}-${index}`}>
                  <strong>{item.day}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </article>

          <figure className="poster-card poster-card--event">
            <Image
              src={featuredEvent.posterUrl}
              alt={featuredEvent.posterAlt}
              width={900}
              height={900}
              className="poster-image"
            />
          </figure>
        </div>

        {extraEvents.length ? (
          <div className="section-block">
            <h3 className="subsection-title">Más eventos cargados</h3>
            <div className="event-card-grid">
              {extraEvents.map((event) => (
                <article className="event-mini-card" key={event.id}>
                  <div className="event-mini-card-image">
                    <Image
                      src={event.posterUrl}
                      alt={event.posterAlt}
                      width={500}
                      height={500}
                    />
                  </div>
                  <div className="event-mini-card-copy">
                    <strong>{event.name}</strong>
                    <span>{event.badgeDate}</span>
                    <p className="small">{event.badgeLocation}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section id="quienes" className="page active-page">
        <h2 className="section-title">
          La esencia del <span>club</span>
        </h2>
        <div className="about-grid">
          <div className="logo-showcase panel">
            <Image
              src="/assets/logo-motoclub.jpeg"
              alt="Logo oficial de Moto Club Jujuy"
              width={500}
              height={500}
            />
          </div>
          <article className="panel rich-text">
            <div dangerouslySetInnerHTML={{ __html: content.quienes }} />
          </article>
        </div>
      </section>

      <section id="fotos" className="page active-page">
        <h2 className="section-title">
          Postales de <span>ruta</span>
        </h2>
        <PhotoCarousel fotos={content.fotos} />
      </section>

      <section className="section-block" id="contacto">
        <h2 className="section-title">
          Contacto y <span>redes</span>
        </h2>
        <div className="contact-grid">
          <article className="panel">
            <div className="social-list">
              {featuredEvent.socialItems.map((item, index) => (
                <div className="social-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="contact-list">
              {featuredEvent.contactItems.map((item, index) => (
                <div className="contact-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
