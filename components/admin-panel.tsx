"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ClubEvent,
  createDefaultEvent,
  EventDay,
  InfoItem,
  internalImageOptions,
  MotoPhoto,
} from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo leer el archivo."));
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function createBlankInfoItem(): InfoItem {
  return { label: "", value: "" };
}

function createBlankDay(): EventDay {
  return { day: "", detail: "" };
}

export function AdminPanel() {
  const { content, saveContent } = useMotoclubContent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [quienes, setQuienes] = useState(content.quienes);
  const [eventsDraft, setEventsDraft] = useState<ClubEvent[]>(content.events);
  const [selectedEventId, setSelectedEventId] = useState(content.events[0]?.id ?? "");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoTitulo, setFotoTitulo] = useState("");
  const [fotoDescripcion, setFotoDescripcion] = useState("");
  const [textoGuardado, setTextoGuardado] = useState("");
  const [fotoGuardada, setFotoGuardada] = useState("");
  const [fotoError, setFotoError] = useState("");
  const [eventoGuardado, setEventoGuardado] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuienes(content.quienes);
  }, [content.quienes]);

  useEffect(() => {
    setEventsDraft(content.events);
    setSelectedEventId((currentId) => {
      if (content.events.some((event) => event.id === currentId)) {
        return currentId;
      }

      return content.events[0]?.id ?? "";
    });
  }, [content.events]);

  const selectedEvent = useMemo(
    () => eventsDraft.find((event) => event.id === selectedEventId) ?? eventsDraft[0] ?? null,
    [eventsDraft, selectedEventId]
  );

  const resetPhotoForm = () => {
    setFotoUrl("");
    setFotoTitulo("");
    setFotoDescripcion("");
    setFotoError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const flashMessage = (setter: (value: string) => void, value: string) => {
    setter(value);
    window.setTimeout(() => setter(""), 2200);
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (user === "admin" && pass === "admin123") {
      setIsAdmin(true);
      setLoginError("");
      return;
    }

    setLoginError("Usuario o contraseña incorrectos.");
  };

  const handleGuardarQuienes = () => {
    saveContent({
      ...content,
      quienes,
    });

    flashMessage(setTextoGuardado, "Texto actualizado correctamente.");
  };

  const handleSelectInternal = (foto: MotoPhoto) => {
    setFotoUrl(foto.url);
    setFotoTitulo(foto.titulo);
    setFotoDescripcion(foto.descripcion);
    setFotoError("");
  };

  const handleLocalFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFotoUrl(dataUrl);
      setFotoTitulo(file.name.replace(/\.[^.]+$/, ""));
      setFotoDescripcion("Imagen subida desde tu dispositivo.");
      setFotoError("");
    } catch {
      setFotoError("No se pudo cargar el archivo seleccionado.");
    }
  };

  const handleOpenWebSearch = () => {
    const searchTerm = encodeURIComponent(
      fotoTitulo.trim() || selectedEvent?.name || "moto club jujuy moto encuentro"
    );
    window.open(`https://www.google.com/search?tbm=isch&q=${searchTerm}`, "_blank");
  };

  const handleAgregarFoto = () => {
    if (!fotoUrl.trim()) {
      setFotoError("Debés elegir una imagen interna, subir un archivo o pegar una URL.");
      return;
    }

    saveContent({
      ...content,
      fotos: [
        ...content.fotos,
        {
          url: fotoUrl.trim(),
          titulo: fotoTitulo.trim() || "Nueva imagen",
          descripcion: fotoDescripcion.trim(),
        },
      ],
    });

    resetPhotoForm();
    flashMessage(setFotoGuardada, "Imagen agregada correctamente.");
  };

  const handleEliminarFoto = (index: number) => {
    const confirmed = window.confirm("¿Eliminar esta imagen de la galería?");
    if (!confirmed) {
      return;
    }

    saveContent({
      ...content,
      fotos: content.fotos.filter((_, fotoIndex) => fotoIndex !== index),
    });
  };

  const updateSelectedEvent = (updater: (event: ClubEvent) => ClubEvent) => {
    if (!selectedEvent) {
      return;
    }

    setEventsDraft((current) =>
      current.map((event) => (event.id === selectedEvent.id ? updater(event) : event))
    );
  };

  const updateSelectedEventField = <K extends keyof ClubEvent>(field: K, value: ClubEvent[K]) => {
    updateSelectedEvent((event) => ({
      ...event,
      [field]: value,
    }));
  };

  const updateInfoCollection = (
    field: "metaItems" | "highlightItems" | "socialItems" | "contactItems",
    index: number,
    key: keyof InfoItem,
    value: string
  ) => {
    updateSelectedEvent((event) => ({
      ...event,
      [field]: event[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addInfoCollectionItem = (
    field: "metaItems" | "highlightItems" | "socialItems" | "contactItems"
  ) => {
    updateSelectedEvent((event) => ({
      ...event,
      [field]: [...event[field], createBlankInfoItem()],
    }));
  };

  const removeInfoCollectionItem = (
    field: "metaItems" | "highlightItems" | "socialItems" | "contactItems",
    index: number
  ) => {
    updateSelectedEvent((event) => ({
      ...event,
      [field]: event[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateDayItem = (index: number, key: keyof EventDay, value: string) => {
    updateSelectedEvent((event) => ({
      ...event,
      dayItems: event.dayItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addDayItem = () => {
    updateSelectedEvent((event) => ({
      ...event,
      dayItems: [...event.dayItems, createBlankDay()],
    }));
  };

  const removeDayItem = (index: number) => {
    updateSelectedEvent((event) => ({
      ...event,
      dayItems: event.dayItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleAddEvent = () => {
    const newEvent = createDefaultEvent();
    setEventsDraft((current) => [...current, newEvent]);
    setSelectedEventId(newEvent.id);
  };

  const handleRemoveSelectedEvent = () => {
    if (!selectedEvent || eventsDraft.length <= 1) {
      return;
    }

    const confirmed = window.confirm("¿Eliminar este evento?");
    if (!confirmed) {
      return;
    }

    const nextEvents = eventsDraft.filter((event) => event.id !== selectedEvent.id);
    setEventsDraft(nextEvents);
    setSelectedEventId(nextEvents[0]?.id ?? "");
  };

  const handleSaveEvents = () => {
    saveContent({
      ...content,
      events: eventsDraft,
    });

    flashMessage(setEventoGuardado, "Eventos actualizados correctamente.");
  };

  if (!isAdmin) {
    return (
      <div className="login-form">
        <h1 className="section-title admin-title">
          Acceso <span>admin</span>
        </h1>
        <form onSubmit={handleLogin}>
          <label htmlFor="admin-user">Usuario</label>
          <input
            id="admin-user"
            type="text"
            placeholder="Usuario"
            autoComplete="off"
            value={user}
            onChange={(event) => setUser(event.target.value)}
          />

          <label htmlFor="admin-pass">Contraseña</label>
          <input
            id="admin-pass"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(event) => setPass(event.target.value)}
          />

          <button type="submit">Ingresar</button>
          <div className="error">{loginError}</div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <section className="admin-section">
        <h2 className="section-title admin-title">
          Editar <span>quiénes somos</span>
        </h2>
        <label htmlFor="edit-quienes">Contenido HTML</label>
        <textarea
          id="edit-quienes"
          value={quienes}
          onChange={(event) => setQuienes(event.target.value)}
        />
        <button type="button" onClick={handleGuardarQuienes}>
          Guardar texto
        </button>
        <div className="success">{textoGuardado}</div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="section-title admin-title">
            Gestionar <span>eventos</span>
          </h2>
          <div className="admin-photo-actions">
            <button type="button" className="ghost-btn" onClick={handleAddEvent}>
              Crear evento
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={handleRemoveSelectedEvent}
              disabled={eventsDraft.length <= 1}
            >
              Eliminar evento
            </button>
          </div>
        </div>

        <div className="admin-event-selector">
          {eventsDraft.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`admin-event-chip ${event.id === selectedEvent?.id ? "is-selected" : ""}`}
              onClick={() => setSelectedEventId(event.id)}
            >
              {event.name || "Evento sin título"}
            </button>
          ))}
        </div>

        {selectedEvent ? (
          <div className="admin-event-form">
            <div className="admin-form-grid">
              <div>
                <label htmlFor="event-name">Nombre del evento</label>
                <input
                  id="event-name"
                  type="text"
                  value={selectedEvent.name}
                  onChange={(event) => updateSelectedEventField("name", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-poster-url">Afiche / imagen principal</label>
                <input
                  id="event-poster-url"
                  type="text"
                  value={selectedEvent.posterUrl}
                  onChange={(event) => updateSelectedEventField("posterUrl", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-poster-alt">Texto alternativo de imagen</label>
                <input
                  id="event-poster-alt"
                  type="text"
                  value={selectedEvent.posterAlt}
                  onChange={(event) => updateSelectedEventField("posterAlt", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-badge-date">Fecha visible</label>
                <input
                  id="event-badge-date"
                  type="text"
                  value={selectedEvent.badgeDate}
                  onChange={(event) => updateSelectedEventField("badgeDate", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-badge-location">Ubicación visible</label>
                <input
                  id="event-badge-location"
                  type="text"
                  value={selectedEvent.badgeLocation}
                  onChange={(event) => updateSelectedEventField("badgeLocation", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-date-numbers">Bloque numérico</label>
                <input
                  id="event-date-numbers"
                  type="text"
                  value={selectedEvent.dateNumbers}
                  onChange={(event) => updateSelectedEventField("dateNumbers", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-date-month">Mes y año</label>
                <input
                  id="event-date-month"
                  type="text"
                  value={selectedEvent.dateMonth}
                  onChange={(event) => updateSelectedEventField("dateMonth", event.target.value)}
                />
              </div>
            </div>

            <div className="admin-form-grid">
              <div>
                <label htmlFor="hero-eyebrow">Eyebrow del hero</label>
                <input
                  id="hero-eyebrow"
                  type="text"
                  value={selectedEvent.heroEyebrow}
                  onChange={(event) => updateSelectedEventField("heroEyebrow", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="hero-prefix">Título principal</label>
                <input
                  id="hero-prefix"
                  type="text"
                  value={selectedEvent.heroHeadlinePrefix}
                  onChange={(event) =>
                    updateSelectedEventField("heroHeadlinePrefix", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="hero-highlight">Título destacado</label>
                <input
                  id="hero-highlight"
                  type="text"
                  value={selectedEvent.heroHeadlineHighlight}
                  onChange={(event) =>
                    updateSelectedEventField("heroHeadlineHighlight", event.target.value)
                  }
                />
              </div>
            </div>

            <label htmlFor="hero-description">Descripción principal</label>
            <textarea
              id="hero-description"
              value={selectedEvent.heroDescription}
              onChange={(event) => updateSelectedEventField("heroDescription", event.target.value)}
            />

            <div className="admin-form-grid">
              <div>
                <label htmlFor="summary-eyebrow">Eyebrow del resumen</label>
                <input
                  id="summary-eyebrow"
                  type="text"
                  value={selectedEvent.summaryEyebrow}
                  onChange={(event) =>
                    updateSelectedEventField("summaryEyebrow", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="summary-prefix">Título resumen</label>
                <input
                  id="summary-prefix"
                  type="text"
                  value={selectedEvent.summaryTitlePrefix}
                  onChange={(event) =>
                    updateSelectedEventField("summaryTitlePrefix", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="summary-highlight">Título resumen destacado</label>
                <input
                  id="summary-highlight"
                  type="text"
                  value={selectedEvent.summaryTitleHighlight}
                  onChange={(event) =>
                    updateSelectedEventField("summaryTitleHighlight", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="section-prefix">Título sección evento</label>
                <input
                  id="section-prefix"
                  type="text"
                  value={selectedEvent.sectionTitlePrefix}
                  onChange={(event) =>
                    updateSelectedEventField("sectionTitlePrefix", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="section-highlight">Parte destacada</label>
                <input
                  id="section-highlight"
                  type="text"
                  value={selectedEvent.sectionTitleHighlight}
                  onChange={(event) =>
                    updateSelectedEventField("sectionTitleHighlight", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="admin-collection-block">
              <div className="admin-collection-head">
                <strong className="admin-picker-title">Metadatos del resumen</strong>
                <button type="button" className="ghost-btn" onClick={() => addInfoCollectionItem("metaItems")}>
                  Agregar fila
                </button>
              </div>
              {selectedEvent.metaItems.map((item, index) => (
                <div className="admin-dual-row" key={`meta-${index}`}>
                  <input
                    type="text"
                    placeholder="Etiqueta"
                    value={item.label}
                    onChange={(event) =>
                      updateInfoCollection("metaItems", index, "label", event.target.value)
                    }
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={item.value}
                    onChange={(event) =>
                      updateInfoCollection("metaItems", index, "value", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removeInfoCollectionItem("metaItems", index)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-collection-block">
              <div className="admin-collection-head">
                <strong className="admin-picker-title">Highlights del evento</strong>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => addInfoCollectionItem("highlightItems")}
                >
                  Agregar fila
                </button>
              </div>
              {selectedEvent.highlightItems.map((item, index) => (
                <div className="admin-dual-row" key={`highlight-${index}`}>
                  <input
                    type="text"
                    placeholder="Etiqueta"
                    value={item.label}
                    onChange={(event) =>
                      updateInfoCollection("highlightItems", index, "label", event.target.value)
                    }
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={item.value}
                    onChange={(event) =>
                      updateInfoCollection("highlightItems", index, "value", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removeInfoCollectionItem("highlightItems", index)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-collection-block">
              <div className="admin-collection-head">
                <strong className="admin-picker-title">Agenda del evento</strong>
                <button type="button" className="ghost-btn" onClick={addDayItem}>
                  Agregar día
                </button>
              </div>
              {selectedEvent.dayItems.map((item, index) => (
                <div className="admin-dual-row" key={`day-${index}`}>
                  <input
                    type="text"
                    placeholder="Día"
                    value={item.day}
                    onChange={(event) => updateDayItem(index, "day", event.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Detalle"
                    value={item.detail}
                    onChange={(event) => updateDayItem(index, "detail", event.target.value)}
                  />
                  <button type="button" className="danger-btn" onClick={() => removeDayItem(index)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-collection-block">
              <div className="admin-collection-head">
                <strong className="admin-picker-title">Redes sociales</strong>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => addInfoCollectionItem("socialItems")}
                >
                  Agregar fila
                </button>
              </div>
              {selectedEvent.socialItems.map((item, index) => (
                <div className="admin-dual-row" key={`social-${index}`}>
                  <input
                    type="text"
                    placeholder="Etiqueta"
                    value={item.label}
                    onChange={(event) =>
                      updateInfoCollection("socialItems", index, "label", event.target.value)
                    }
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={item.value}
                    onChange={(event) =>
                      updateInfoCollection("socialItems", index, "value", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removeInfoCollectionItem("socialItems", index)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-collection-block">
              <div className="admin-collection-head">
                <strong className="admin-picker-title">Contacto del evento</strong>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => addInfoCollectionItem("contactItems")}
                >
                  Agregar fila
                </button>
              </div>
              {selectedEvent.contactItems.map((item, index) => (
                <div className="admin-dual-row" key={`contact-${index}`}>
                  <input
                    type="text"
                    placeholder="Etiqueta"
                    value={item.label}
                    onChange={(event) =>
                      updateInfoCollection("contactItems", index, "label", event.target.value)
                    }
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={item.value}
                    onChange={(event) =>
                      updateInfoCollection("contactItems", index, "value", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removeInfoCollectionItem("contactItems", index)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={handleSaveEvents}>
              Guardar eventos
            </button>
            <div className="success">{eventoGuardado}</div>
          </div>
        ) : null}
      </section>

      <section className="admin-section">
        <h2 className="section-title admin-title">
          Galería <span>de fotos</span>
        </h2>

        <div className="admin-photo-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Subir desde tu compu
          </button>
          <button type="button" className="ghost-btn" onClick={handleOpenWebSearch}>
            Buscar en la web
          </button>
          <button type="button" className="ghost-btn" onClick={resetPhotoForm}>
            Limpiar selección
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only-input"
          onChange={handleLocalFileChange}
        />

        <div className="admin-picker-block">
          <strong className="admin-picker-title">Imágenes internas del sitio</strong>
          <div className="admin-internal-grid">
            {internalImageOptions.map((foto) => (
              <button
                key={foto.url}
                type="button"
                className={`admin-internal-card ${fotoUrl === foto.url ? "is-selected" : ""}`}
                onClick={() => handleSelectInternal(foto)}
              >
                <img src={foto.url} alt={foto.titulo} loading="lazy" />
                <span>{foto.titulo}</span>
              </button>
            ))}
          </div>
        </div>

        <label htmlFor="nueva-foto-url">URL, ruta interna o imagen subida</label>
        <input
          id="nueva-foto-url"
          type="text"
          placeholder="/assets/nueva-imagen.jpg, https://... o archivo local"
          value={fotoUrl}
          onChange={(event) => setFotoUrl(event.target.value)}
        />

        <label htmlFor="nueva-foto-titulo">Título</label>
        <input
          id="nueva-foto-titulo"
          type="text"
          placeholder="Título de la foto"
          value={fotoTitulo}
          onChange={(event) => setFotoTitulo(event.target.value)}
        />

        <label htmlFor="nueva-foto-descripcion">Descripción</label>
        <input
          id="nueva-foto-descripcion"
          type="text"
          placeholder="Breve descripción"
          value={fotoDescripcion}
          onChange={(event) => setFotoDescripcion(event.target.value)}
        />

        {fotoUrl ? (
          <div className="admin-preview-card">
            <strong className="admin-picker-title">Vista previa</strong>
            <div className="admin-preview-frame">
              <img src={fotoUrl} alt={fotoTitulo || "Vista previa"} loading="lazy" />
            </div>
          </div>
        ) : null}

        <button type="button" onClick={handleAgregarFoto}>
          Agregar imagen
        </button>

        <div className="error">{fotoError}</div>
        <div className="success">{fotoGuardada}</div>

        <div className="admin-gallery">
          {content.fotos.length ? (
            content.fotos.map((foto, index) => (
              <article key={`${foto.url}-${index}`}>
                <img src={foto.url} alt={foto.titulo} loading="lazy" />
                <strong>{foto.titulo}</strong>
                <p className="small">{foto.descripcion || ""}</p>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => handleEliminarFoto(index)}
                >
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p className="small">No hay imágenes cargadas.</p>
          )}
        </div>
      </section>

      <section className="admin-section">
        <button className="ghost-btn" type="button" onClick={() => setIsAdmin(false)}>
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
