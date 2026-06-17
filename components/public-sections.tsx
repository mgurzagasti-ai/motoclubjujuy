"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { PhotoCarousel } from "@/components/photo-carousel";
import { ClubEvent, defaultContent, sortNewsNewestFirst } from "@/lib/site-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

function buildSocialHref(label: string, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
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
        {compact ? (
          <button
            type="button"
            className="btn btn-secondary registration-toggle"
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "Ocultar formulario" : event.registrationLabel}
          </button>
        ) : null}
      </div>

      {!compact && registrationHref ? (
        <a className="btn btn-primary registration-link-btn" href={registrationHref} target="_blank" rel="noreferrer">
          {event.registrationLabel}
        </a>
      ) : null}

      {isOpen ? (
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
  const { content } = useMotoclubContent();
  const featuredEvent = content.events[0] ?? defaultContent.events[0];
  const extraEvents = content.events.slice(1);
  const novedades = sortNewsNewestFirst(
    content.novedades.length ? content.novedades : defaultContent.novedades
  );
  const registrationHref = buildRegistrationHref(featuredEvent.registrationHref);

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
              {registrationHref ? (
                <a
                  className="btn btn-secondary"
                  href={registrationHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {featuredEvent.registrationLabel}
                </a>
              ) : null}
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
                  <div className="event-mini-card-image">
                    <Image src={event.posterUrl} alt={event.posterAlt} width={500} height={500} />
                  </div>
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

      <section id="novedades" className="page active-page">
        <h2 className="section-title">
          Ultimas <span>novedades</span>
        </h2>
        <div className="news-grid">
          {novedades.map((item) => (
            <article className="news-card" key={item.id}>
              <div className="news-card-image">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.imageAlt || item.title} width={900} height={700} />
                ) : (
                  <div className="admin-news-preview-empty">Sin imagen</div>
                )}
              </div>
              <div className="news-card-copy">
                <div className="news-card-meta">
                  <span>{item.tag}</span>
                  <span>{item.date}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
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
              {featuredEvent.socialItems.map((item, index) => {
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
