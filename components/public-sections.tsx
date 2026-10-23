"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { PhotoCarousel } from "@/components/photo-carousel";
import { ClubEvent, sortNewsNewestFirst } from "@/lib/site-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

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

function buildRegistrationHref(value?: string) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.includes("@") && !trimmedValue.includes(" ")) {
    return `mailto:${trimmedValue}`;
  }

  const phone = trimmedValue.replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}` : trimmedValue;
}

function usesExternalRegistrationLink(value?: string) {
  const registrationHref = buildRegistrationHref(value);
  return Boolean(registrationHref && /^https?:\/\//i.test(registrationHref));
}

type EventRegistrationFormProps = {
  event: ClubEvent;
  compact?: boolean;
};

function EventRegistrationForm({ event, compact = false }: EventRegistrationFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(!compact);
  const registrationHref = buildRegistrationHref(event.registrationHref);
  const shouldUseExternalRegistration = usesExternalRegistrationLink(event.registrationHref);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setCity("");
    setNotes("");
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (!fullName.trim()) {
      setError("Necesitamos al menos tu nombre para registrar la inscripcion.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setStatus("");

    try {
      if (!hasSupabaseConfig() || !supabase) {
        throw new Error("Supabase todavia no esta configurado.");
      }

      const { error: insertError } = await supabase.from("event_registrations").insert({
        event_id: event.id,
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
      });

      if (insertError) {
        throw insertError;
      }

      setStatus("Inscripcion enviada correctamente.");
      resetForm();
      if (compact) {
        setIsOpen(false);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No se pudo enviar la inscripcion."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`registration-form-shell ${compact ? "is-compact" : ""}`}>
      <div className="registration-form-head">
        <div>
          <span className="event-mini-registration-title">{event.registrationTitle}</span>
          <p className="small registration-copy">{event.registrationDescription}</p>
        </div>
        {compact && !shouldUseExternalRegistration ? (
          <button
            type="button"
            className="btn btn-secondary registration-toggle"
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "Ocultar formulario" : event.registrationLabel}
          </button>
        ) : null}
      </div>

      {registrationHref && shouldUseExternalRegistration ? (
        <a className="btn btn-primary registration-link-btn" href={registrationHref} target="_blank" rel="noreferrer">
          {event.registrationLabel}
        </a>
      ) : null}

      {isOpen && !shouldUseExternalRegistration ? (
        <form className="registration-form" onSubmit={handleSubmit}>
          <div className="registration-grid">
            <div>
              <label htmlFor={`full-name-${event.id}`}>Nombre completo</label>
              <input
                id={`full-name-${event.id}`}
                type="text"
                value={fullName}
                onChange={(inputEvent) => setFullName(inputEvent.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label htmlFor={`email-${event.id}`}>Email</label>
              <input
                id={`email-${event.id}`}
                type="email"
                value={email}
                onChange={(inputEvent) => setEmail(inputEvent.target.value)}
                placeholder="mail@ejemplo.com"
              />
            </div>
            <div>
              <label htmlFor={`phone-${event.id}`}>Telefono</label>
              <input
                id={`phone-${event.id}`}
                type="text"
                value={phone}
                onChange={(inputEvent) => setPhone(inputEvent.target.value)}
                placeholder="+54 9 ..."
              />
            </div>
            <div>
              <label htmlFor={`city-${event.id}`}>Ciudad</label>
              <input
                id={`city-${event.id}`}
                type="text"
                value={city}
                onChange={(inputEvent) => setCity(inputEvent.target.value)}
                placeholder="Tu ciudad"
              />
            </div>
          </div>

          <label htmlFor={`notes-${event.id}`}>Mensaje o comentario</label>
          <textarea
            id={`notes-${event.id}`}
            value={notes}
            onChange={(inputEvent) => setNotes(inputEvent.target.value)}
            placeholder="Contanos si venis con grupo, moto club, consultas, etc."
          />

          <div className="registration-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar inscripcion"}
            </button>
            {compact && registrationHref ? (
              <a
                className="btn btn-secondary registration-link-btn"
                href={registrationHref}
                target="_blank"
                rel="noreferrer"
              >
                Contacto directo
              </a>
            ) : null}
          </div>

          {error ? <div className="error">{error}</div> : null}
          {status ? <div className="success">{status}</div> : null}
        </form>
      ) : null}
    </div>
  );
}

export function PublicSections() {
  const { content, featuredEventId, siteSettings, contentReady } = useMotoclubContent();
  const [zoomedDayIndex, setZoomedDayIndex] = useState<number | null>(null);
  const [zoomedNewsIndex, setZoomedNewsIndex] = useState<number | null>(null);
  const publishedEvents = content.events.filter((event) => event.published !== false);
  const featuredEvent =
    publishedEvents.find((event) => event.id === featuredEventId) ?? publishedEvents[0] ?? null;
  const extraEvents = publishedEvents.filter((event) => event.id !== featuredEvent?.id);
  const novedades = sortNewsNewestFirst(content.novedades.filter((item) => item.published !== false));
  const registrationHref = buildRegistrationHref(featuredEvent?.registrationHref);
  const zoomedDay =
    zoomedDayIndex === null ? null : featuredEvent?.dayItems[zoomedDayIndex] ?? null;
  const zoomedNews = zoomedNewsIndex === null ? null : novedades[zoomedNewsIndex];

  if (!contentReady) {
    return (
      <section id="inicio" className="page active-page">
        <div className="hero">
          <div className="hero-copy">
            <h1>Moto Club Jujuy</h1>
            <p>Cargando contenido...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="inicio" className="page active-page">
        {featuredEvent ? (
          <>
            <div className="hero">
              <div className="hero-copy">
                <div className="eyebrow">{siteSettings.heroEyebrow || featuredEvent.heroEyebrow}</div>
                <h1>
                  {siteSettings.heroTitle || <>{featuredEvent.heroHeadlinePrefix}{" "}<span>{featuredEvent.heroHeadlineHighlight}</span></>}
                </h1>
                <p>{siteSettings.heroSubtitle || featuredEvent.heroDescription}</p>
                <div className="hero-actions">
                  <a className="btn btn-primary" href={siteSettings.heroPrimaryHref || "#evento"}>
                    {siteSettings.heroPrimaryLabel || "Ver evento"}
                  </a>
                  {(siteSettings.heroSecondaryHref || registrationHref) ? (
                    <a
                      className="btn btn-secondary"
                      href={siteSettings.heroSecondaryHref || registrationHref || "#evento"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {siteSettings.heroSecondaryLabel || featuredEvent.registrationLabel}
                    </a>
                  ) : null}
                </div>
              </div>

              {(siteSettings.heroImage || featuredEvent.posterUrl) ? (
                <div className="hero-visual">
                  <Image
                    src={siteSettings.heroImage || featuredEvent.posterUrl}
                    alt={siteSettings.heroImage ? (siteSettings.heroTitle || "Imagen de portada") : featuredEvent.posterAlt}
                    width={900}
                    height={900}
                    className="poster-image"
                    unoptimized
                    priority
                  />
                  <div className="hero-badge">
                    <strong>{featuredEvent.badgeDate}</strong>
                    <span>{featuredEvent.badgeLocation}</span>
                  </div>
                </div>
              ) : null}
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
          </>
        ) : (
          <div className="hero">
            <div className="hero-copy">
              {siteSettings.heroEyebrow ? <div className="eyebrow">{siteSettings.heroEyebrow}</div> : null}
              <h1>{siteSettings.heroTitle || siteSettings.clubName || "Moto Club Jujuy"}</h1>
              <p>{siteSettings.heroSubtitle || "No hay eventos publicados por el momento."}</p>
              {siteSettings.heroPrimaryHref ? <a className="btn btn-primary" href={siteSettings.heroPrimaryHref}>{siteSettings.heroPrimaryLabel || "Conocer más"}</a> : null}
            </div>
            {siteSettings.heroImage ? <div className="hero-visual"><Image src={siteSettings.heroImage} alt={siteSettings.heroTitle || "Imagen de portada"} width={900} height={900} className="poster-image" unoptimized /></div> : null}
          </div>
        )}
      </section>

      {featuredEvent ? (
      <section id="evento" className="page active-page">
        <h2 className="section-title">
          <span>{featuredEvent.sectionTitlePrefix}</span> {featuredEvent.sectionTitleHighlight}
        </h2>
        <div className="event-grid">
          <article className="panel panel--full">
            <div className="day-list">
              {featuredEvent.dayItems.map((item, index) => (
                <div className="day-item" key={`${item.day}-${index}`}>
                  {item.imageUrl ? (
                    <button
                      type="button"
                      className="day-item-image"
                      onClick={() => setZoomedDayIndex(index)}
                      aria-label={`Ampliar tarjeta de ${item.day}`}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt || item.day}
                        width={900}
                        height={600}
                      />
                    </button>
                  ) : null}
                  <div className="day-item-copy">
                    <strong>{item.day}</strong>
                    <span>{item.detail}</span>
                    {item.imageUrl ? (
                      <button
                        type="button"
                        className="day-zoom-btn"
                        onClick={() => setZoomedDayIndex(index)}
                      >
                        Ver mas grande
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="section-block registration-shell">
          <article className="panel registration-panel">
            <EventRegistrationForm event={featuredEvent} />
          </article>
        </div>

        {extraEvents.length ? (
          <div className="section-block">
            <h3 className="subsection-title">Mas eventos cargados</h3>
            <div className="event-card-grid">
              {extraEvents.map((event) => (
                <article className="event-mini-card" key={event.id}>
                  {event.posterUrl ? (
                    <div className="event-mini-card-image">
                      <Image src={event.posterUrl} alt={event.posterAlt} width={500} height={500} />
                    </div>
                  ) : null}
                  <div className="event-mini-card-copy">
                    <strong>{event.name}</strong>
                    <span>{event.badgeDate}</span>
                    <p className="small">{event.badgeLocation}</p>
                    <div className="event-mini-registration">
                      <EventRegistrationForm event={event} compact />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      <section id="novedades" className="page active-page">
        <h2 className="section-title">{siteSettings.newsTitle || <>Ultimas <span>novedades</span></>}</h2>
        <div className="news-grid">
          {novedades.map((item, index) => (
            <article className="news-card" key={item.id}>
              <button
                type="button"
                className="news-card-image"
                onClick={() => item.imageUrl && setZoomedNewsIndex(index)}
                aria-label={`Ampliar novedad ${item.title}`}
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.imageAlt || item.title} width={900} height={700} />
                ) : (
                  <div className="admin-news-preview-empty">Sin imagen</div>
                )}
              </button>
              <div className="news-card-copy">
                <div className="news-card-meta">
                  <span>{item.tag}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                {item.imageUrl ? (
                  <button
                    type="button"
                    className="day-zoom-btn"
                    onClick={() => setZoomedNewsIndex(index)}
                  >
                    Ver mas grande
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {novedades.length === 0 ? <p>No hay novedades publicadas por el momento.</p> : null}
        </div>
      </section>

      <section id="quienes" className="page active-page">
        <h2 className="section-title">{siteSettings.aboutTitle || <>La esencia del <span>club</span></>}</h2>
        <div className="about-grid">
          <div className="logo-showcase panel">
            <Image
              src={siteSettings.aboutImageUrl || "/assets/logo-motoclub.jpeg"}
              alt="Logo oficial de Moto Club Jujuy"
              width={500}
              height={500}
              unoptimized
            />
          </div>
          <article className="panel rich-text">
            <div dangerouslySetInnerHTML={{ __html: content.quienes }} />
          </article>
        </div>
      </section>

      <section id="fotos" className="page active-page">
        <h2 className="section-title">{siteSettings.galleryTitle || <>Postales de <span>ruta</span></>}</h2>
        <PhotoCarousel fotos={content.fotos.filter((foto) => foto.published !== false)} />
      </section>

      <section className="section-block" id="contacto">
        <h2 className="section-title">{siteSettings.contactTitle || <>Contacto y <span>redes</span></>}</h2>
        {siteSettings.contactText ? <p>{siteSettings.contactText}</p> : null}
        {(featuredEvent || siteSettings.contactItems || siteSettings.socialItems) ? <div className="contact-grid">
          <article className="panel">
            <div className="social-list">
              {(siteSettings.socialItems ?? featuredEvent?.socialItems ?? []).map((item, index) => {
                const socialHref = buildSocialHref(item.label, item.value);

                return (
                  <div className="social-item" key={`${item.label}-${index}`}>
                    <strong>{item.label}</strong>
                    {socialHref ? (
                      <a className="social-link" href={socialHref} target="_blank" rel="noreferrer">
                        {item.value}
                      </a>
                    ) : (
                      <span>{item.value}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <div className="contact-list">
              {(siteSettings.contactItems ?? featuredEvent?.contactItems ?? []).map((item, index) => (
                <div className="contact-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  {buildSocialHref(item.label, item.value) ? (
                    <a href={buildSocialHref(item.label, item.value) || undefined}>{item.value}</a>
                  ) : <span>{item.value}</span>}
                </div>
              ))}
            </div>
          </article>
        </div> : <p>No hay datos de contacto publicados por el momento.</p>}
      </section>

      {zoomedDay ? (
        <div
          className="event-zoom-backdrop"
          role="presentation"
          onClick={() => setZoomedDayIndex(null)}
        >
          <div
            className="event-zoom-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-zoom-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="event-zoom-close"
              onClick={() => setZoomedDayIndex(null)}
              aria-label="Cerrar ampliacion"
            >
              Cerrar
            </button>
            <div className="event-zoom-image">
              <Image
                src={zoomedDay.imageUrl || ""}
                alt={zoomedDay.imageAlt || zoomedDay.day}
                width={1400}
                height={1000}
              />
            </div>
            <div className="event-zoom-copy">
              <strong id="event-zoom-title">{zoomedDay.day}</strong>
              <p>{zoomedDay.detail}</p>
            </div>
          </div>
        </div>
      ) : null}

      {zoomedNews ? (
        <div
          className="event-zoom-backdrop"
          role="presentation"
          onClick={() => setZoomedNewsIndex(null)}
        >
          <div
            className="event-zoom-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-zoom-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="event-zoom-close"
              onClick={() => setZoomedNewsIndex(null)}
              aria-label="Cerrar ampliacion de novedad"
            >
              Cerrar
            </button>
            <div className="event-zoom-image">
              <Image
                src={zoomedNews.imageUrl || ""}
                alt={zoomedNews.imageAlt || zoomedNews.title}
                width={1400}
                height={1000}
              />
            </div>
            <div className="event-zoom-copy">
              <strong id="news-zoom-title">{zoomedNews.title}</strong>
              <p>{zoomedNews.description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
