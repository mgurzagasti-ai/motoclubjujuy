"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { PhotoCarousel } from "@/components/photo-carousel";
import { ClubEvent, sortNewsNewestFirst } from "@/lib/site-data";
import { hasText, imageUrl, publishedEvents, publishedNews, publishedPhotos } from "@/lib/public-content";
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
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const markImageFailed = (value: string) => {
    const url = imageUrl(value);
    if (url) setFailedImages((current) => current.has(url) ? current : new Set(current).add(url));
  };
  const visibleImage = (value: unknown) => {
    const url = imageUrl(value);
    return url && !failedImages.has(url) ? url : null;
  };
  const visibleEvents = publishedEvents(content.events);
  const featuredEvent =
    visibleEvents.find((event) => event.id === featuredEventId) ?? visibleEvents[0] ?? null;
  const extraEvents = visibleEvents.filter((event) => event.id !== featuredEvent?.id);
  const novedades = sortNewsNewestFirst(publishedNews(content.novedades));
  const photos = publishedPhotos(content.fotos).filter((photo) => visibleImage(photo.url));
  const eventDays = featuredEvent?.dayItems.filter((item) =>
    hasText(item.day) || hasText(item.detail) || visibleImage(item.imageUrl)
  ) ?? [];
  const eventMeta = featuredEvent?.metaItems.filter((item) => hasText(item.label) || hasText(item.value)) ?? [];
  const eventHighlights = featuredEvent?.highlightItems.filter((item) => hasText(item.label) || hasText(item.value)) ?? [];
  const showEventSummary = Boolean(featuredEvent && (
    hasText(featuredEvent.summaryEyebrow) || hasText(featuredEvent.summaryTitlePrefix) ||
    hasText(featuredEvent.summaryTitleHighlight) || hasText(featuredEvent.dateNumbers) ||
    hasText(featuredEvent.dateMonth) || eventMeta.length
  ));
  const showEventHeadline = Boolean(featuredEvent && (
    hasText(featuredEvent.summaryEyebrow) || hasText(featuredEvent.summaryTitlePrefix) ||
    hasText(featuredEvent.summaryTitleHighlight) || hasText(featuredEvent.dateNumbers) ||
    hasText(featuredEvent.dateMonth)
  ));
  const showRegistration = Boolean(featuredEvent && (
    hasText(featuredEvent.registrationTitle) || hasText(featuredEvent.registrationDescription) ||
    hasText(featuredEvent.registrationHref)
  ));
  const showEventSection = Boolean(featuredEvent && (eventDays.length || showRegistration || extraEvents.length));
  const registrationHref = buildRegistrationHref(featuredEvent?.registrationHref);
  const heroImage = visibleImage(siteSettings.heroImage) || visibleImage(featuredEvent?.posterUrl);
  const heroPrimaryHref = siteSettings.heroPrimaryHref?.trim() || (showEventSection ? "#evento" : "");
  const showHeroButton = Boolean(heroPrimaryHref && (heroPrimaryHref !== "#evento" || showEventSection));
  const heroSecondaryHref = siteSettings.heroSecondaryHref?.trim() || registrationHref || "";
  const showSecondaryButton = Boolean(heroSecondaryHref && (heroSecondaryHref !== "#evento" || showEventSection));
  const showStandaloneHero = !featuredEvent && Boolean(
    hasText(siteSettings.heroTitle) || hasText(siteSettings.heroSubtitle) || heroImage
  );
  const aboutText = content.quienes.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
  const aboutImage = visibleImage(siteSettings.aboutImageUrl || (aboutText ? "/assets/logo-motoclub.jpeg" : ""));
  const contactItems = (siteSettings.contactItems ?? featuredEvent?.contactItems ?? [])
    .filter((item) => hasText(item.label) && hasText(item.value));
  const socialItems = (siteSettings.socialItems ?? featuredEvent?.socialItems ?? [])
    .filter((item) => hasText(item.label) && hasText(item.value));
  const selectedDay = zoomedDayIndex === null ? null : eventDays[zoomedDayIndex] ?? null;
  const zoomedDay = selectedDay && visibleImage(selectedDay.imageUrl) ? selectedDay : null;
  const selectedNews = zoomedNewsIndex === null ? null : novedades[zoomedNewsIndex];
  const zoomedNews = selectedNews && visibleImage(selectedNews.imageUrl) ? selectedNews : null;

  if (!contentReady) {
    return null;
  }

  return (
    <>
      {(featuredEvent || showStandaloneHero) ? <section id="inicio" className="page active-page">
        {featuredEvent ? (
          <>
            <div className={`hero${heroImage ? "" : " hero--text-only"}`}>
              <div className="hero-copy">
                {hasText(siteSettings.heroEyebrow || featuredEvent.heroEyebrow) ? <div className="eyebrow">{siteSettings.heroEyebrow || featuredEvent.heroEyebrow}</div> : null}
                <h1>
                  {hasText(siteSettings.heroTitle)
                    ? siteSettings.heroTitle
                    : hasText(featuredEvent.heroHeadlinePrefix) || hasText(featuredEvent.heroHeadlineHighlight)
                      ? <>{featuredEvent.heroHeadlinePrefix}{" "}<span>{featuredEvent.heroHeadlineHighlight}</span></>
                      : featuredEvent.name}
                </h1>
                {hasText(siteSettings.heroSubtitle || featuredEvent.heroDescription) ? <p>{siteSettings.heroSubtitle || featuredEvent.heroDescription}</p> : null}
                {(showHeroButton || showSecondaryButton) ? <div className="hero-actions">
                  {showHeroButton ? <a className="btn btn-primary" href={heroPrimaryHref}>
                    {siteSettings.heroPrimaryLabel || (heroPrimaryHref === "#evento" ? "Ver evento" : "Conocer más")}
                  </a> : null}
                  {showSecondaryButton ? (
                    <a
                      className="btn btn-secondary"
                      href={heroSecondaryHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {siteSettings.heroSecondaryLabel || featuredEvent.registrationLabel || "Más información"}
                    </a>
                  ) : null}
                </div> : null}
              </div>

              {heroImage ? (
                <div className="hero-visual">
                  <Image
                    src={heroImage}
                    alt={siteSettings.heroImage ? (siteSettings.heroTitle || "Imagen de portada") : featuredEvent.posterAlt}
                    width={900}
                    height={900}
                    className="poster-image"
                    unoptimized
                    priority
                    onError={() => markImageFailed(heroImage)}
                  />
                  {(hasText(featuredEvent.badgeDate) || hasText(featuredEvent.badgeLocation)) ? <div className="hero-badge">
                    <strong>{featuredEvent.badgeDate}</strong>
                    <span>{featuredEvent.badgeLocation}</span>
                  </div> : null}
                </div>
              ) : null}
            </div>

            {(showEventSummary || eventHighlights.length > 0) ? <div className="section-block event-grid">
              {showEventSummary ? <article className="panel">
                {showEventHeadline ? <div className="event-headline">
                  <div>
                    {hasText(featuredEvent.summaryEyebrow) ? <div className="eyebrow">{featuredEvent.summaryEyebrow}</div> : null}
                    {(hasText(featuredEvent.summaryTitlePrefix) || hasText(featuredEvent.summaryTitleHighlight)) ? <h2 className="section-title">
                      {featuredEvent.summaryTitlePrefix}{" "}
                      <span>{featuredEvent.summaryTitleHighlight}</span>
                    </h2> : null}
                  </div>
                  {(hasText(featuredEvent.dateNumbers) || hasText(featuredEvent.dateMonth)) ? <div className="event-date">
                    <strong>{featuredEvent.dateNumbers}</strong>
                    <span>{featuredEvent.dateMonth}</span>
                  </div> : null}
                </div> : null}

                {eventMeta.length > 0 ? <div className="event-meta">
                  {eventMeta.map((item, index) => (
                    <div className="meta-item" key={`${item.label}-${index}`}>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div> : null}
              </article> : null}

              {eventHighlights.length > 0 ? <aside className="panel">
                <div className="highlights">
                  {eventHighlights.map((item, index) => (
                    <div className="highlight-item" key={`${item.label}-${index}`}>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </aside> : null}
            </div> : null}
          </>
        ) : (
          <div className={`hero${heroImage ? "" : " hero--text-only"}`}>
            <div className="hero-copy">
              {siteSettings.heroEyebrow ? <div className="eyebrow">{siteSettings.heroEyebrow}</div> : null}
              {hasText(siteSettings.heroTitle) ? <h1>{siteSettings.heroTitle}</h1> : null}
              {hasText(siteSettings.heroSubtitle) ? <p>{siteSettings.heroSubtitle}</p> : null}
              {(showHeroButton || showSecondaryButton) ? <div className="hero-actions">
                {showHeroButton ? <a className="btn btn-primary" href={heroPrimaryHref}>{siteSettings.heroPrimaryLabel || "Conocer más"}</a> : null}
                {showSecondaryButton ? <a className="btn btn-secondary" href={heroSecondaryHref} target="_blank" rel="noreferrer">{siteSettings.heroSecondaryLabel || "Más información"}</a> : null}
              </div> : null}
            </div>
            {heroImage ? <div className="hero-visual"><Image src={heroImage} alt={siteSettings.heroTitle || "Imagen de portada"} width={900} height={900} className="poster-image" unoptimized onError={() => markImageFailed(heroImage)} /></div> : null}
          </div>
        )}
      </section> : null}

      {showEventSection && featuredEvent ? (
      <section id="evento" className="page active-page">
        {(hasText(featuredEvent.sectionTitlePrefix) || hasText(featuredEvent.sectionTitleHighlight)) ? <h2 className="section-title">
          <span>{featuredEvent.sectionTitlePrefix}</span> {featuredEvent.sectionTitleHighlight}
        </h2> : null}
        {eventDays.length > 0 ? <div className="event-grid">
          <article className="panel panel--full">
            <div className="day-list">
              {eventDays.map((item, index) => (
                <div className="day-item" key={`${item.day}-${index}`}>
                  {visibleImage(item.imageUrl) ? (
                    <button
                      type="button"
                      className="day-item-image"
                      onClick={() => setZoomedDayIndex(index)}
                      aria-label={`Ampliar tarjeta de ${item.day}`}
                    >
                      <Image
                        src={visibleImage(item.imageUrl) || ""}
                        alt={item.imageAlt || item.day}
                        width={900}
                        height={600}
                        unoptimized
                        onError={() => markImageFailed(item.imageUrl || "")}
                      />
                    </button>
                  ) : null}
                  {(hasText(item.day) || hasText(item.detail)) ? <div className="day-item-copy">
                    {hasText(item.day) ? <strong>{item.day}</strong> : null}
                    {hasText(item.detail) ? <span>{item.detail}</span> : null}
                    {visibleImage(item.imageUrl) ? (
                      <button
                        type="button"
                        className="day-zoom-btn"
                        onClick={() => setZoomedDayIndex(index)}
                      >
                        Ver mas grande
                      </button>
                    ) : null}
                  </div> : null}
                </div>
              ))}
            </div>
          </article>
        </div> : null}

        {showRegistration ? <div className="section-block registration-shell">
          <article className="panel registration-panel">
            <EventRegistrationForm event={featuredEvent} />
          </article>
        </div> : null}

        {extraEvents.length ? (
          <div className="section-block">
            <h3 className="subsection-title">Mas eventos cargados</h3>
            <div className="event-card-grid">
              {extraEvents.map((event) => (
                <article className="event-mini-card" key={event.id}>
                  {visibleImage(event.posterUrl) ? (
                    <div className="event-mini-card-image">
                      <Image src={visibleImage(event.posterUrl) || ""} alt={event.posterAlt} width={500} height={500} unoptimized onError={() => markImageFailed(event.posterUrl)} />
                    </div>
                  ) : null}
                  <div className="event-mini-card-copy">
                    <strong>{event.name}</strong>
                    {hasText(event.badgeDate) ? <span>{event.badgeDate}</span> : null}
                    {hasText(event.badgeLocation) ? <p className="small">{event.badgeLocation}</p> : null}
                    {(hasText(event.registrationTitle) || hasText(event.registrationDescription) || hasText(event.registrationHref)) ? <div className="event-mini-registration">
                      <EventRegistrationForm event={event} compact />
                    </div> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {novedades.length > 0 ? <section id="novedades" className="page active-page">
        <h2 className="section-title">{siteSettings.newsTitle || <>Ultimas <span>novedades</span></>}</h2>
        <div className="news-grid">
          {novedades.map((item, index) => (
            <article className="news-card" key={item.id}>
              {visibleImage(item.imageUrl) ? <button
                type="button"
                className="news-card-image"
                onClick={() => setZoomedNewsIndex(index)}
                aria-label={`Ampliar novedad ${item.title}`}
              >
                <Image src={visibleImage(item.imageUrl) || ""} alt={item.imageAlt || item.title} width={900} height={700} unoptimized onError={() => markImageFailed(item.imageUrl)} />
              </button> : null}
              <div className="news-card-copy">
                {hasText(item.tag) ? <div className="news-card-meta">
                  <span>{item.tag}</span>
                </div> : null}
                <strong>{item.title}</strong>
                {hasText(item.description) ? <p>{item.description}</p> : null}
                {visibleImage(item.imageUrl) ? (
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
        </div>
      </section> : null}

      {(aboutText || aboutImage) ? <section id="quienes" className="page active-page">
        <h2 className="section-title">{siteSettings.aboutTitle || <>La esencia del <span>club</span></>}</h2>
        <div className={`about-grid${aboutImage && aboutText ? "" : " about-grid--single"}`}>
          {aboutImage ? <div className="logo-showcase panel">
            <Image
              src={aboutImage}
              alt="Logo oficial de Moto Club Jujuy"
              width={500}
              height={500}
              unoptimized
              onError={() => markImageFailed(aboutImage)}
            />
          </div> : null}
          {aboutText ? <article className="panel rich-text">
            <div dangerouslySetInnerHTML={{ __html: content.quienes }} />
          </article> : null}
        </div>
      </section> : null}

      {photos.length > 0 ? <section id="fotos" className="page active-page">
        <h2 className="section-title">{siteSettings.galleryTitle || <>Postales de <span>ruta</span></>}</h2>
        <PhotoCarousel fotos={photos} onImageError={markImageFailed} />
      </section> : null}

      {(hasText(siteSettings.contactText) || contactItems.length > 0 || socialItems.length > 0) ? <section className="section-block" id="contacto">
        <h2 className="section-title">{siteSettings.contactTitle || <>Contacto y <span>redes</span></>}</h2>
        {hasText(siteSettings.contactText) ? <p>{siteSettings.contactText}</p> : null}
        {(contactItems.length > 0 || socialItems.length > 0) ? <div className={`contact-grid${contactItems.length && socialItems.length ? "" : " contact-grid--single"}`}>
          {socialItems.length > 0 ? <article className="panel">
            <div className="social-list">
              {socialItems.map((item, index) => {
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
          </article> : null}

          {contactItems.length > 0 ? <article className="panel">
            <div className="contact-list">
              {contactItems.map((item, index) => (
                <div className="contact-item" key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  {buildSocialHref(item.label, item.value) ? (
                    <a href={buildSocialHref(item.label, item.value) || undefined}>{item.value}</a>
                  ) : <span>{item.value}</span>}
                </div>
              ))}
            </div>
          </article> : null}
        </div> : null}
      </section> : null}

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
                unoptimized
                onError={() => markImageFailed(zoomedDay.imageUrl || "")}
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
                unoptimized
                onError={() => markImageFailed(zoomedNews.imageUrl)}
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
