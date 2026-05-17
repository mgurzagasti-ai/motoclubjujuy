"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ClubEvent,
  createDefaultEvent,
  createDefaultNewsItem,
  EventDay,
  InfoItem,
  internalImageOptions,
  MotoPhoto,
  NewsItem,
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
  const { content, saveContent, cloudinaryEnabled, refreshPhotos, contentSource } =
    useMotoclubContent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [quienes, setQuienes] = useState(content.quienes);
  const [eventsDraft, setEventsDraft] = useState<ClubEvent[]>(content.events);
  const [newsDraft, setNewsDraft] = useState<NewsItem[]>(content.novedades);
  const [selectedEventId, setSelectedEventId] = useState(content.events[0]?.id ?? "");
  const [selectedNewsId, setSelectedNewsId] = useState(content.novedades[0]?.id ?? "");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoTitulo, setFotoTitulo] = useState("");
  const [fotoDescripcion, setFotoDescripcion] = useState("");
  const [textoGuardado, setTextoGuardado] = useState("");
  const [fotoGuardada, setFotoGuardada] = useState("");
  const [fotoError, setFotoError] = useState("");
  const [eventoGuardado, setEventoGuardado] = useState("");
  const [novedadGuardada, setNovedadGuardada] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newsFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    setNewsDraft(content.novedades);
    setSelectedNewsId((currentId) => {
      if (content.novedades.some((item) => item.id === currentId)) {
        return currentId;
      }

      return content.novedades[0]?.id ?? "";
    });
  }, [content.novedades]);

  const selectedEvent = useMemo(
    () => eventsDraft.find((event) => event.id === selectedEventId) ?? eventsDraft[0] ?? null,
    [eventsDraft, selectedEventId]
  );

  const selectedNews = useMemo(
    () => newsDraft.find((item) => item.id === selectedNewsId) ?? newsDraft[0] ?? null,
    [newsDraft, selectedNewsId]
  );

  const resetPhotoForm = () => {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }

    setSelectedFile(null);
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

  const persistContent = async (nextSnapshot: typeof content) => {
    const response = await fetch("/api/site-content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: user,
        password: pass,
        content: nextSnapshot,
      }),
    });

    const payload = (await response.json()) as { error?: string; content?: typeof content };

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo guardar el contenido.");
    }

    saveContent(payload.content || nextSnapshot);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user,
          password: pass,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo iniciar sesion.");
      }

      setIsAdmin(true);
      setLoginError("");
    } catch (loginFailure) {
      setLoginError(
        loginFailure instanceof Error ? loginFailure.message : "No se pudo iniciar sesion."
      );
    }
  };

  const handleGuardarQuienes = async () => {
    try {
      await persistContent({
      ...content,
      quienes,
      events: eventsDraft,
      novedades: newsDraft,
      });
      flashMessage(setTextoGuardado, "Texto actualizado correctamente.");
    } catch (saveFailure) {
      setLoginError(
        saveFailure instanceof Error ? saveFailure.message : "No se pudo guardar el contenido."
      );
    }
  };

  const handleSelectInternal = (foto: MotoPhoto) => {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }

    setSelectedFile(null);
    setFotoUrl(foto.url);
    setFotoTitulo(foto.titulo);
    setFotoDescripcion(foto.descripcion);
    setFotoError("");
  };

  const handleLocalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current);
      }

      const previewUrl = URL.createObjectURL(file);
      photoPreviewUrlRef.current = previewUrl;
      setSelectedFile(file);
      setFotoUrl(previewUrl);
      setFotoTitulo(file.name.replace(/\.[^.]+$/, ""));
      setFotoDescripcion("Imagen subida desde tu dispositivo.");
      setFotoError("");
    } catch {
      setFotoError("No se pudo cargar el archivo seleccionado.");
    }
  };

  const handleSelectNewsInternal = (foto: MotoPhoto) => {
    updateSelectedNews((item) => ({
      ...item,
      imageUrl: foto.url,
      imageAlt: foto.titulo,
    }));
  };

  const handleNewsLocalFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedNews) {
      return;
    }

    try {
      const previewUrl = await fileToDataUrl(file);
      updateSelectedNews((item) => ({
        ...item,
        imageUrl: previewUrl,
        imageAlt: item.imageAlt || file.name.replace(/\.[^.]+$/, ""),
      }));
      setFotoError("");
    } catch {
      setFotoError("No se pudo cargar la imagen para la novedad.");
    } finally {
      if (newsFileInputRef.current) {
        newsFileInputRef.current.value = "";
      }
    }
  };

  const handleOpenWebSearch = () => {
    const searchTerm = encodeURIComponent(
      fotoTitulo.trim() || selectedEvent?.name || "moto club jujuy moto encuentro"
    );
    window.open(`https://www.google.com/search?tbm=isch&q=${searchTerm}`, "_blank");
  };

  const handleEliminarFoto = (index: number) => {
    const confirmed = window.confirm("Eliminar esta imagen de la galeria?");
    if (!confirmed) {
      return;
    }

    saveContent({
      ...content,
      quienes,
      events: eventsDraft,
      novedades: newsDraft,
      fotos: content.fotos.filter((_, fotoIndex) => fotoIndex !== index),
    });
  };

  const handleAgregarFotoActual = async () => {
    const trimmedUrl = fotoUrl.trim();

    if (!trimmedUrl) {
      setFotoError("Debes subir una imagen o pegar una URL publica.");
      return;
    }

    if (cloudinaryEnabled) {
      if (!selectedFile && !/^https?:\/\//i.test(trimmedUrl)) {
        setFotoError("Con Cloudinary debes subir un archivo o usar una URL publica completa.");
        return;
      }

      setIsUploadingPhoto(true);
      setFotoError("");

      try {
        const body = new FormData();
        body.set("title", fotoTitulo.trim() || "Nueva imagen");
        body.set("description", fotoDescripcion.trim());

        if (selectedFile) {
          body.set("file", selectedFile);
        } else {
          body.set("sourceUrl", trimmedUrl);
        }

        const response = await fetch("/api/photos", {
          method: "POST",
          body,
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo subir la imagen.");
        }

        await refreshPhotos();
        resetPhotoForm();
        flashMessage(setFotoGuardada, "Imagen subida correctamente a Cloudinary.");
      } catch (error) {
        setFotoError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
      } finally {
        setIsUploadingPhoto(false);
      }

      return;
    }

    const finalUrl = selectedFile ? await fileToDataUrl(selectedFile) : trimmedUrl;

    saveContent({
      ...content,
      quienes,
      events: eventsDraft,
      novedades: newsDraft,
      fotos: [
        ...content.fotos,
        {
          url: finalUrl,
          titulo: fotoTitulo.trim() || "Nueva imagen",
          descripcion: fotoDescripcion.trim(),
        },
      ],
    });

    resetPhotoForm();
    flashMessage(setFotoGuardada, "Imagen agregada correctamente.");
  };

  const handleEliminarFotoActual = async (foto: MotoPhoto, index: number) => {
    const confirmed = window.confirm("Eliminar esta imagen de la galeria?");
    if (!confirmed) {
      return;
    }

    if (cloudinaryEnabled && foto.publicId) {
      try {
        const response = await fetch("/api/photos", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicId: foto.publicId }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo eliminar la imagen.");
        }

        await refreshPhotos();
        return;
      } catch (error) {
        setFotoError(error instanceof Error ? error.message : "No se pudo eliminar la imagen.");
        return;
      }
    }

    handleEliminarFoto(index);
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

    const confirmed = window.confirm("Eliminar este evento?");
    if (!confirmed) {
      return;
    }

    const nextEvents = eventsDraft.filter((event) => event.id !== selectedEvent.id);
    setEventsDraft(nextEvents);
    setSelectedEventId(nextEvents[0]?.id ?? "");
  };

  const handleSaveEvents = async () => {
    try {
      await persistContent({
        ...content,
        quienes,
        events: eventsDraft,
        novedades: newsDraft,
      });
      flashMessage(setEventoGuardado, "Eventos actualizados correctamente.");
    } catch (saveFailure) {
      setFotoError(
        saveFailure instanceof Error ? saveFailure.message : "No se pudieron guardar los eventos."
      );
    }
  };

  const updateSelectedNews = (updater: (item: NewsItem) => NewsItem) => {
    if (!selectedNews) {
      return;
    }

    setNewsDraft((current) =>
      current.map((item) => (item.id === selectedNews.id ? updater(item) : item))
    );
  };

  const updateSelectedNewsField = <K extends keyof NewsItem>(field: K, value: NewsItem[K]) => {
    updateSelectedNews((item) => ({
      ...item,
      [field]: value,
    }));
  };

  const handleAddNews = () => {
    const newItem = createDefaultNewsItem();
    setNewsDraft((current) => [...current, newItem]);
    setSelectedNewsId(newItem.id);
  };

  const handleRemoveSelectedNews = () => {
    if (!selectedNews || newsDraft.length <= 1) {
      return;
    }

    const confirmed = window.confirm(
      `Eliminar la novedad "${selectedNews.title || "Sin titulo"}"?`
    );
    if (!confirmed) {
      return;
    }

    const nextNews = newsDraft.filter((item) => item.id !== selectedNews.id);
    setNewsDraft(nextNews);
    setSelectedNewsId(nextNews[0]?.id ?? "");
  };

  const handleSaveNews = async () => {
    try {
      await persistContent({
        ...content,
        quienes,
        events: eventsDraft,
        novedades: newsDraft,
      });
      flashMessage(setNovedadGuardada, "Novedades actualizadas correctamente.");
    } catch (saveFailure) {
      setFotoError(
        saveFailure instanceof Error ? saveFailure.message : "No se pudieron guardar las novedades."
      );
    }
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

          <label htmlFor="admin-pass">Contrasena</label>
          <input
            id="admin-pass"
            type="password"
            placeholder="Contrasena"
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
          Estado de <span>integracion</span>
        </h2>
        <p className="small">
          Contenido publico actual: {contentSource === "supabase" ? "Supabase" : "Almacenamiento local"}
        </p>
        <p className="small">
          Los cambios del admin ahora intentan guardarse en Supabase usando una ruta segura del
          servidor.
        </p>
      </section>

      <section className="admin-section">
        <h2 className="section-title admin-title">
          Editar <span>quienes somos</span>
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
        <div className="error">{loginError}</div>
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
              {event.name || "Evento sin titulo"}
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
                <label htmlFor="event-poster-url">Afiche o imagen principal</label>
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
                <label htmlFor="event-badge-location">Ubicacion visible</label>
                <input
                  id="event-badge-location"
                  type="text"
                  value={selectedEvent.badgeLocation}
                  onChange={(event) => updateSelectedEventField("badgeLocation", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-date-numbers">Bloque numerico</label>
                <input
                  id="event-date-numbers"
                  type="text"
                  value={selectedEvent.dateNumbers}
                  onChange={(event) => updateSelectedEventField("dateNumbers", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-date-month">Mes y ano</label>
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
                <label htmlFor="hero-prefix">Titulo principal</label>
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
                <label htmlFor="hero-highlight">Titulo destacado</label>
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

            <label htmlFor="hero-description">Descripcion principal</label>
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
                <label htmlFor="summary-prefix">Titulo resumen</label>
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
                <label htmlFor="summary-highlight">Titulo resumen destacado</label>
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
                <label htmlFor="section-prefix">Titulo seccion evento</label>
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
                <strong className="admin-picker-title">Inscripcion del evento</strong>
              </div>
              <div className="admin-form-grid">
                <div>
                  <label htmlFor="registration-title">Titulo del bloque</label>
                  <input
                    id="registration-title"
                    type="text"
                    value={selectedEvent.registrationTitle}
                    onChange={(event) =>
                      updateSelectedEventField("registrationTitle", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label htmlFor="registration-label">Texto del boton</label>
                  <input
                    id="registration-label"
                    type="text"
                    value={selectedEvent.registrationLabel}
                    onChange={(event) =>
                      updateSelectedEventField("registrationLabel", event.target.value)
                    }
                  />
                </div>
              </div>
              <label htmlFor="registration-description">Descripcion de inscripcion</label>
              <textarea
                id="registration-description"
                value={selectedEvent.registrationDescription}
                onChange={(event) =>
                  updateSelectedEventField("registrationDescription", event.target.value)
                }
              />
              <label htmlFor="registration-href">Link o telefono para inscripcion</label>
              <input
                id="registration-href"
                type="text"
                placeholder="https://..., mail@..., +549..."
                value={selectedEvent.registrationHref}
                onChange={(event) =>
                  updateSelectedEventField("registrationHref", event.target.value)
                }
              />
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
                  Agregar dia
                </button>
              </div>
              {selectedEvent.dayItems.map((item, index) => (
                <div className="admin-dual-row" key={`day-${index}`}>
                  <input
                    type="text"
                    placeholder="Dia"
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
            <div className="error">{fotoError}</div>
          </div>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="section-title admin-title">
            Gestionar <span>novedades</span>
          </h2>
          <div className="admin-photo-actions">
            <button type="button" className="ghost-btn" onClick={handleAddNews}>
              Crear novedad
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={handleRemoveSelectedNews}
              disabled={newsDraft.length <= 1}
            >
              Eliminar novedad
            </button>
          </div>
        </div>

        <div className="admin-event-selector">
          {newsDraft.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-event-chip ${item.id === selectedNews?.id ? "is-selected" : ""}`}
              onClick={() => setSelectedNewsId(item.id)}
            >
              {item.title || "Novedad sin titulo"}
            </button>
          ))}
        </div>

        {selectedNews ? (
          <div className="admin-event-form">
            <div className="admin-photo-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => newsFileInputRef.current?.click()}
              >
                Subir imagen
              </button>
            </div>

            <input
              ref={newsFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only-input"
              onChange={handleNewsLocalFileChange}
            />

            <div className="admin-form-grid">
              <div>
                <label htmlFor="news-title">Titulo</label>
                <input
                  id="news-title"
                  type="text"
                  value={selectedNews.title}
                  onChange={(event) => updateSelectedNewsField("title", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="news-tag">Etiqueta</label>
                <input
                  id="news-tag"
                  type="text"
                  value={selectedNews.tag}
                  onChange={(event) => updateSelectedNewsField("tag", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="news-date">Fecha visible</label>
                <input
                  id="news-date"
                  type="text"
                  value={selectedNews.date}
                  onChange={(event) => updateSelectedNewsField("date", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="news-image">Imagen</label>
                <input
                  id="news-image"
                  type="text"
                  value={selectedNews.imageUrl}
                  onChange={(event) => updateSelectedNewsField("imageUrl", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="news-alt">Texto alternativo</label>
                <input
                  id="news-alt"
                  type="text"
                  value={selectedNews.imageAlt}
                  onChange={(event) => updateSelectedNewsField("imageAlt", event.target.value)}
                />
              </div>
            </div>

            <div className="admin-picker-block">
              <strong className="admin-picker-title">Imagenes internas para novedades</strong>
              <div className="admin-internal-grid">
                {internalImageOptions.map((foto) => (
                  <button
                    key={`news-${foto.url}`}
                    type="button"
                    className={`admin-internal-card ${
                      selectedNews.imageUrl === foto.url ? "is-selected" : ""
                    }`}
                    onClick={() => handleSelectNewsInternal(foto)}
                  >
                    <img src={foto.url} alt={foto.titulo} loading="lazy" />
                    <span>{foto.titulo}</span>
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="news-description">Descripcion</label>
            <textarea
              id="news-description"
              value={selectedNews.description}
              onChange={(event) => updateSelectedNewsField("description", event.target.value)}
            />

            {selectedNews.imageUrl ? (
              <div className="admin-preview-card">
                <strong className="admin-picker-title">Vista previa de novedad</strong>
                <div className="admin-preview-frame">
                  <img src={selectedNews.imageUrl} alt={selectedNews.imageAlt || "Vista previa"} loading="lazy" />
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleSaveNews}>
              Guardar novedades
            </button>
            <div className="success">{novedadGuardada}</div>
            <div className="error">{fotoError}</div>
          </div>
        ) : null}
      </section>

      <section className="admin-section">
        <h2 className="section-title admin-title">
          Galeria <span>de fotos</span>
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
            Limpiar seleccion
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
          <strong className="admin-picker-title">Imagenes internas del sitio</strong>
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
          onChange={(event) => {
            if (photoPreviewUrlRef.current) {
              URL.revokeObjectURL(photoPreviewUrlRef.current);
              photoPreviewUrlRef.current = null;
            }

            setSelectedFile(null);
            setFotoUrl(event.target.value);
          }}
        />

        <label htmlFor="nueva-foto-titulo">Titulo</label>
        <input
          id="nueva-foto-titulo"
          type="text"
          placeholder="Titulo de la foto"
          value={fotoTitulo}
          onChange={(event) => setFotoTitulo(event.target.value)}
        />

        <label htmlFor="nueva-foto-descripcion">Descripcion</label>
        <input
          id="nueva-foto-descripcion"
          type="text"
          placeholder="Breve descripcion"
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

        <button type="button" onClick={handleAgregarFotoActual} disabled={isUploadingPhoto}>
          {isUploadingPhoto ? "Subiendo imagen..." : cloudinaryEnabled ? "Subir a Cloudinary" : "Agregar imagen"}
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
                  onClick={() => handleEliminarFotoActual(foto, index)}
                  disabled={cloudinaryEnabled && !foto.publicId}
                >
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p className="small">No hay imagenes cargadas.</p>
          )}
        </div>
      </section>

      <section className="admin-section">
        <button className="ghost-btn" type="button" onClick={() => setIsAdmin(false)}>
          Cerrar sesion
        </button>
      </section>
    </div>
  );
}
