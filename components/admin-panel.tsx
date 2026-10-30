"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ClubEvent,
  createDefaultNavItem,
  createDefaultEvent,
  createDefaultNewsItem,
  EventDay,
  InfoItem,
  internalImageOptions,
  MotoPhoto,
  NavItem,
  getEditableNavItems,
  navbarSavedEvent,
  NewsItem,
  normalizeNavHref,
  sortNewsNewestFirst,
} from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";
import type { SiteSettings } from "@/lib/site-settings";
import type { AdminSection } from "@/lib/admin-section-save";
import { AdminGarage } from "@/components/admin-garage";

type TextSetting = Exclude<keyof SiteSettings, "contactItems" | "socialItems" | "garageNavVisible">;
const settingFields: { key: TextSetting; label: string }[] = [
  { key: "clubName", label: "Nombre del club" },
  { key: "clubTagline", label: "Lema del club" },
  { key: "introButtonLabel", label: "Texto del botón de ingreso" },
  { key: "aboutTitle", label: "Título institucional" },
  { key: "newsTitle", label: "Título de novedades" },
  { key: "galleryTitle", label: "Título de galería" },
  { key: "contactTitle", label: "Título de contacto" },
  { key: "footerDescription", label: "Descripción del pie de página" },
  { key: "footerLegal", label: "Texto legal del pie de página" },
  { key: "footerContactTitle", label: "Título de contacto en el pie" },
  { key: "footerContactText", label: "Texto de contacto en el pie" },
  { key: "footerCredit", label: "Crédito del pie de página" },
  { key: "logoUrl", label: "URL del logo de cabecera" },
  { key: "aboutImageUrl", label: "URL de imagen institucional" },
  { key: "heroEyebrow", label: "Antetítulo de portada" },
  { key: "heroTitle", label: "Título de portada" },
  { key: "heroSubtitle", label: "Texto de portada" },
  { key: "heroImage", label: "URL de imagen de portada" },
  { key: "heroPrimaryLabel", label: "Texto del botón principal" },
  { key: "heroPrimaryHref", label: "Enlace del botón principal" },
  { key: "heroSecondaryLabel", label: "Texto del botón secundario" },
  { key: "heroSecondaryHref", label: "Enlace del botón secundario" },
  { key: "contactText", label: "Texto de contacto" },
  { key: "lodgingTitle", label: "Título de alojamientos" },
  { key: "lodgingEyebrow", label: "Antetítulo de alojamientos" },
  { key: "lodgingDescription", label: "Descripción de alojamientos" },
  { key: "lodgingImageUrl", label: "URL de imagen de alojamientos" },
  { key: "lodgingLinkLabel", label: "Texto del enlace de alojamientos" },
  { key: "lodgingLinkUrl", label: "Enlace de alojamientos" },
];

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

function imageFileToSizedDataUrl(file: File, maxWidth = 1600, quality = 0.82) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("No se pudo leer el archivo."));
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("No se pudo preparar la imagen."));
          return;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function createBlankInfoItem(): InfoItem {
  return { label: "", value: "" };
}

function createBlankDay(): EventDay {
  return { day: "", detail: "", imageUrl: "", imageAlt: "" };
}

export function AdminPanel() {
  const { content, featuredEventId, setFeaturedEventId, saveContent, getContentVersion, cloudinaryEnabled, refreshSupabaseContent, contentSource } =
    useMotoclubContent();
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>({});
  const setSetting = (key: keyof SiteSettings, value: string) =>
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  const handleSettingImageFile = async (key: "logoUrl" | "aboutImageUrl" | "heroImage" | "lodgingImageUrl", file?: File) => {
    if (!file) return;
    try {
      if (cloudinaryEnabled) {
        const body = new FormData();
        body.set("title", key);
        body.set("file", file);
        const response = await fetch("/api/photos", { method: "POST", headers: photoAuthHeaders(), body });
        const payload = (await response.json()) as { error?: string; photo?: MotoPhoto };
        if (!response.ok || !payload.photo?.url) throw new Error(payload.error || "No se pudo subir la imagen.");
        setSetting(key, payload.photo.url);
      } else {
        const dataUrl = await imageFileToSizedDataUrl(file, 1200, 0.75);
        if (dataUrl.length > 1_500_000) throw new Error("La imagen es demasiado pesada.");
        setSetting(key, dataUrl);
      }
      setSettingsError("");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "No se pudo preparar la imagen.");
    }
  };
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [aboutError, setAboutError] = useState("");
  const [navError, setNavError] = useState("");
  const [isSavingNav, setIsSavingNav] = useState(false);
  const [navDraft, setNavDraft] = useState<NavItem[]>(getEditableNavItems(content.navItems, settingsDraft.garageNavVisible));
  const [quienes, setQuienes] = useState(content.quienes);
  const [eventsDraft, setEventsDraft] = useState<ClubEvent[]>(content.events);
  const [newsDraft, setNewsDraft] = useState<NewsItem[]>(content.novedades);
  const [selectedEventId, setSelectedEventId] = useState(content.events[0]?.id ?? "");
  const [featuredEventDraftId, setFeaturedEventDraftId] = useState(featuredEventId);
  const [selectedNewsId, setSelectedNewsId] = useState(content.novedades[0]?.id ?? "");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoTitulo, setFotoTitulo] = useState("");
  const [fotoDescripcion, setFotoDescripcion] = useState("");
  const [settingsSaved, setSettingsSaved] = useState("");
  const [aboutSaved, setAboutSaved] = useState("");
  const [navSaved, setNavSaved] = useState("");
  const [fotoGuardada, setFotoGuardada] = useState("");
  const [fotoError, setFotoError] = useState("");
  const [eventoGuardado, setEventoGuardado] = useState("");
  const [novedadGuardada, setNovedadGuardada] = useState("");
  const [newsError, setNewsError] = useState("");
  const [isSavingNews, setIsSavingNews] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState("");
  const [saveConflict, setSaveConflict] = useState("");
  const [isUploadingNewsImage, setIsUploadingNewsImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newsFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const saveModalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveModalTimeoutRef.current) {
        window.clearTimeout(saveModalTimeoutRef.current);
      }
    };
  }, []);

  const selectedEvent = useMemo(
    () => eventsDraft.find((event) => event.id === selectedEventId) ?? eventsDraft[0] ?? null,
    [eventsDraft, selectedEventId]
  );

  const selectedNews = useMemo(
    () => newsDraft.find((item) => item.id === selectedNewsId) ?? newsDraft[0] ?? null,
    [newsDraft, selectedNewsId]
  );
  const newsPreviewItems = useMemo(() => sortNewsNewestFirst(newsDraft), [newsDraft]);

  const buildNewsSnapshot = (items: NewsItem[] = newsDraft) =>
    sortNewsNewestFirst(
      items.map((item) => ({
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
        title: item.title.trim(),
        tag: item.tag.trim(),
        date: item.date.trim(),
        description: item.description.trim(),
        imageUrl: item.imageUrl.trim(),
        imageAlt: item.imageAlt.trim(),
      }))
    );

  const resetPhotoForm = () => {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }

    setSelectedFile(null);
    setEditingPhotoIndex(null);
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

  const openSaveModal = (message: string) => {
    if (saveModalTimeoutRef.current) {
      window.clearTimeout(saveModalTimeoutRef.current);
    }

    setSaveModalMessage(message);
    saveModalTimeoutRef.current = window.setTimeout(() => {
      setSaveModalMessage("");
      saveModalTimeoutRef.current = null;
    }, 2200);
  };

  const persistSection = async (section: AdminSection, sectionData: unknown) => {
    const expectedUpdatedAt = getContentVersion();
    if (expectedUpdatedAt === undefined) {
      throw new Error("No se cargó la versión del contenido. Recargá ADMIN antes de guardar.");
    }

    const response = await fetch("/api/site-content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: user,
        password: pass,
        section,
        sectionData,
        expectedUpdatedAt,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      detail?: string;
      content?: typeof content;
      featuredEventId?: string;
      settings?: SiteSettings;
      updatedAt?: string | null;
    };

    if (response.status === 409 || response.status === 428) {
      const message = payload.error || "El contenido cambió en otra pestaña. Tus ediciones siguen en el formulario.";
      setSaveConflict(message);
      throw new Error(message);
    }

    if (!response.ok) {
      throw new Error(
        payload.detail ? `${payload.error || "No se pudo guardar el contenido."} ${payload.detail}` : payload.error || "No se pudo guardar el contenido."
      );
    }

    if (!payload.updatedAt) {
      throw new Error("El servidor guardó el contenido pero no devolvió su versión. Recargá ADMIN antes de seguir.");
    }

    if (!payload.content) {
      throw new Error("El servidor no devolvió el contenido guardado. Recargá ADMIN antes de seguir.");
    }
    saveContent(payload.content, payload.updatedAt, payload.settings);
    if (section === "settings" && payload.settings) setSettingsDraft(payload.settings);
    if (section === "events") setFeaturedEventDraftId(payload.featuredEventId ?? "");
    setFeaturedEventId(payload.featuredEventId ?? "");
    setSaveConflict("");
  };

  const photoAuthHeaders = () => {
    const bytes = new TextEncoder().encode(`${user}:${pass}`);
    const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
    return { Authorization: `Basic ${encoded}` };
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

      const loaded = await refreshSupabaseContent();
      if (!loaded) {
        throw new Error("No se pudo cargar el contenido actualizado de Supabase. Intentá ingresar nuevamente.");
      }

      setIsAdmin(true);
      setNavDraft(getEditableNavItems(loaded.content.navItems, loaded.settings.garageNavVisible));
      setQuienes(loaded.content.quienes);
      setEventsDraft(loaded.content.events);
      setFeaturedEventDraftId(loaded.featuredEventId);
      setSettingsDraft(loaded.settings);
      setNewsDraft(loaded.content.novedades);
      setSelectedEventId(loaded.content.events[0]?.id ?? "");
      setSelectedNewsId(loaded.content.novedades[0]?.id ?? "");
      setLoginError("");
      setSettingsError("");
      setAboutError("");
      setNavError("");
      setSaveConflict("");
    } catch (loginFailure) {
      setLoginError(
        loginFailure instanceof Error ? loginFailure.message : "No se pudo iniciar sesion."
      );
    }
  };

  const handleGuardarQuienes = async () => {
    try {
      await persistSection("about", quienes);
      setAboutError("");
      flashMessage(setAboutSaved, "Texto actualizado correctamente.");
    } catch (saveFailure) {
      setAboutError(
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

  const handleNewsLocalFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedNews) {
      return;
    }

    try {
      setIsUploadingNewsImage(true);
      let imageUrl = "";

      if (cloudinaryEnabled) {
        const body = new FormData();
        body.set("title", (selectedNews.title.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 120));
        body.set("description", selectedNews.description.trim().slice(0, 500));
        body.set("file", file);

        const response = await fetch("/api/photos", {
          method: "POST",
          headers: photoAuthHeaders(),
          body,
        });

        const payload = (await response.json()) as {
          error?: string;
          photo?: MotoPhoto;
        };

        if (!response.ok || !payload.photo?.url) {
          throw new Error(payload.error || "No se pudo subir la imagen.");
        }

        imageUrl = payload.photo.url;
      } else {
        imageUrl = await imageFileToSizedDataUrl(file);

        if (imageUrl.length > 1_500_000) {
          throw new Error(
            "La imagen sigue siendo muy pesada para guardar en Supabase. Usa una mas liviana o configura Cloudinary."
          );
        }
      }

      updateSelectedNews((item) => ({
        ...item,
        imageUrl,
        imageAlt: item.imageAlt || file.name.replace(/\.[^.]+$/, ""),
      }));
      setNewsError("");
    } catch (error) {
      setNewsError(
        error instanceof Error ? error.message : "No se pudo cargar la imagen para la novedad."
      );
    } finally {
      setIsUploadingNewsImage(false);
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

  const buildPhotosWithoutIndex = (index: number) =>
    content.fotos.filter((_, fotoIndex) => fotoIndex !== index);

  const updateNavItem = <K extends keyof NavItem>(index: number, key: K, value: NavItem[K]) => {
    setNavDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  const moveNavItem = (index: number, direction: -1 | 1) => {
    setNavDraft((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const handleAddNavItem = () => {
    setNavDraft((current) => {
      const nextItem = createDefaultNavItem(current.length + 10);
      return [nextItem, ...current];
    });
  };

  const handleRemoveNavItem = (index: number) => {
    setNavDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveNavItems = async () => {
    if (isSavingNav) return;
    setIsSavingNav(true);
    setNavSaved("");
    setNavError("");
    try {
      const normalizedNavItems = navDraft.map((item, index) => ({
        ...item,
        href: normalizeNavHref(item.href, createDefaultNavItem(index).href),
        adminManaged: true,
        garageManaged: true,
      }));

      await persistSection("nav", normalizedNavItems);
      setNavDraft(normalizedNavItems);
      window.dispatchEvent(new Event(navbarSavedEvent));
      setNavError("");
      flashMessage(setNavSaved, "Menu actualizado correctamente.");
    } catch (saveFailure) {
      setNavError(
        saveFailure instanceof Error ? `No se pudo guardar el menú. ${saveFailure.message}` : "No se pudo guardar el menú."
      );
    } finally {
      setIsSavingNav(false);
    }
  };

  const handleAgregarFotoActual = async () => {
    const trimmedUrl = fotoUrl.trim();

    if (!trimmedUrl) {
      setFotoError("Debes subir una imagen o pegar una URL publica.");
      return;
    }

    if (editingPhotoIndex !== null && !selectedFile) {
      try {
        await persistSection("photos", content.fotos.map((foto, index) => index === editingPhotoIndex
            ? { ...foto, url: trimmedUrl, titulo: fotoTitulo.trim() || "Nueva imagen", descripcion: fotoDescripcion.trim() }
            : foto));
        resetPhotoForm();
        flashMessage(setFotoGuardada, "Fotografía actualizada.");
      } catch (error) {
        setFotoError(error instanceof Error ? error.message : "No se pudo actualizar la fotografía.");
      }
      return;
    }

    if (cloudinaryEnabled) {
      if (!selectedFile) {
        setFotoError("Por seguridad, descargá la imagen y subí el archivo desde tu equipo.");
        return;
      }

      setIsUploadingPhoto(true);
      setFotoError("");

      try {
        const body = new FormData();
        body.set("title", fotoTitulo.trim() || "Nueva imagen");
        body.set("description", fotoDescripcion.trim());

        body.set("file", selectedFile);

        const response = await fetch("/api/photos", {
          method: "POST",
          headers: photoAuthHeaders(),
          body,
        });

        const payload = (await response.json()) as { error?: string; photo?: MotoPhoto };

        if (!response.ok || !payload.photo) {
          throw new Error(payload.error || "No se pudo subir la imagen.");
        }

        await persistSection("photos", editingPhotoIndex === null
            ? [...content.fotos, payload.photo]
            : content.fotos.map((foto, index) => index === editingPhotoIndex ? { ...payload.photo!, published: foto.published } : foto));
        resetPhotoForm();
        flashMessage(setFotoGuardada, "Imagen subida a Cloudinary y guardada en Supabase.");
      } catch (error) {
        setFotoError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
      } finally {
        setIsUploadingPhoto(false);
      }

      return;
    }

    const finalUrl = selectedFile ? await fileToDataUrl(selectedFile) : trimmedUrl;

    try {
      await persistSection("photos", editingPhotoIndex === null ? [
          ...content.fotos, {
            url: finalUrl,
            titulo: fotoTitulo.trim() || "Nueva imagen",
            descripcion: fotoDescripcion.trim(),
          },
        ] : content.fotos.map((foto, index) => index === editingPhotoIndex ? {
          ...foto, url: finalUrl, titulo: fotoTitulo.trim() || "Nueva imagen", descripcion: fotoDescripcion.trim(),
        } : foto));

      resetPhotoForm();
      flashMessage(setFotoGuardada, "Imagen agregada y guardada en Supabase.");
    } catch (error) {
      setFotoError(error instanceof Error ? error.message : "No se pudo guardar la imagen.");
    }
  };

  const handleEliminarFotoActual = async (foto: MotoPhoto, index: number) => {
    const expectedUpdatedAt = getContentVersion();
    if (expectedUpdatedAt === undefined) {
      setFotoError("No se cargó la versión de la galería. Recargá ADMIN antes de borrar.");
      return;
    }

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
            ...photoAuthHeaders(),
          },
          body: JSON.stringify({ publicId: foto.publicId, expectedUpdatedAt }),
        });

        const payload = (await response.json()) as {
          error?: string;
          photos?: MotoPhoto[];
          updatedAt?: string;
          warning?: string;
        };

        if (response.status === 409 || response.status === 428) {
          setSaveConflict(payload.error || "El contenido cambió en otra pestaña. No se borró la imagen.");
        }

        if (!response.ok || !payload.photos) {
          throw new Error(payload.error || "No se pudo eliminar la imagen.");
        }

        const hasUnsavedDrafts =
          JSON.stringify(navDraft) !== JSON.stringify(content.navItems) ||
          quienes !== content.quienes ||
          JSON.stringify(eventsDraft) !== JSON.stringify(content.events) ||
          JSON.stringify(newsDraft) !== JSON.stringify(content.novedades);
        const canAdoptVersion = !saveConflict && !hasUnsavedDrafts && Boolean(payload.updatedAt);
        saveContent({ ...content, fotos: payload.photos }, canAdoptVersion ? payload.updatedAt : undefined);
        if (!canAdoptVersion) {
          setSaveConflict("La galería cambió mientras había ediciones pendientes. No se guardarán otros cambios hasta recargar ADMIN.");
        }
        setFotoError(payload.warning || "");
        if (!payload.warning) {
          flashMessage(setFotoGuardada, "Imagen eliminada correctamente.");
        }
        return;
      } catch (error) {
        setFotoError(error instanceof Error ? error.message : "No se pudo eliminar la imagen.");
        return;
      }
    }

    try {
      await persistSection("photos", buildPhotosWithoutIndex(index));
      flashMessage(setFotoGuardada, "Imagen eliminada correctamente.");
    } catch (error) {
      setFotoError(error instanceof Error ? error.message : "No se pudo eliminar la imagen.");
    }
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
    const template = createDefaultEvent();
    const newEvent = {
      ...Object.fromEntries(Object.entries(template).map(([key, value]) =>
        [key, Array.isArray(value) ? [] : typeof value === "string" ? "" : value]
      )) as unknown as ClubEvent,
      id: template.id,
      published: false,
    };
    setEventsDraft((current) => [...current, newEvent]);
    setSelectedEventId(newEvent.id);
  };

  const handleRemoveSelectedEvent = () => {
    if (!selectedEvent) {
      return;
    }

    const confirmed = window.confirm("Eliminar este evento?");
    if (!confirmed) {
      return;
    }

    const nextEvents = eventsDraft.filter((event) => event.id !== selectedEvent.id);
    setEventsDraft(nextEvents);
    setSelectedEventId(nextEvents[0]?.id ?? "");
    if (!nextEvents.length || featuredEventDraftId === selectedEvent.id) {
      setFeaturedEventDraftId(nextEvents.find((event) => event.published !== false)?.id ?? "");
    }
  };

  const handleSaveEvents = async () => {
    try {
      await persistSection("events", {
        events: eventsDraft,
        featuredEventId: eventsDraft.length ? featuredEventDraftId : "",
      });
      setFotoError("");
      flashMessage(setEventoGuardado, "Eventos actualizados correctamente.");
      openSaveModal("El evento se guardo correctamente.");
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
    const newItem = { ...createDefaultNewsItem(), title: "", tag: "", published: false };
    setNewsDraft((current) => [newItem, ...current]);
    setSelectedNewsId(newItem.id);
    setNewsError("");
  };

  const handleRemoveSelectedNews = async () => {
    if (!selectedNews || isSavingNews) {
      return;
    }

    const confirmed = window.confirm(
      `Eliminar la novedad "${selectedNews.title || "Sin titulo"}"?`
    );
    if (!confirmed) {
      return;
    }

    const removedId = selectedNews.id;
    const nextNews = newsDraft.filter((item) => item.id !== removedId);
    setIsSavingNews(true);
    setNewsError("");
    setNovedadGuardada("");
    try {
      // Delete only this ID from the saved collection, preserving other unsaved drafts.
      await persistSection("news", content.novedades.filter((item) => item.id !== removedId));
      setNewsDraft((current) => current.filter((item) => item.id !== removedId));
      setSelectedNewsId((current) => current === removedId ? nextNews[0]?.id ?? "" : current);
      flashMessage(setNovedadGuardada, "Novedad eliminada correctamente.");
      openSaveModal("La novedad se eliminó correctamente.");
    } catch (saveFailure) {
      const detail = saveFailure instanceof Error ? saveFailure.message : "Intentá nuevamente.";
      setNewsError(`No se pudo eliminar la novedad. ${detail}`);
    } finally {
      setIsSavingNews(false);
    }
  };

  const saveNews = async (items: NewsItem[]) => {
    if (isSavingNews) return;
    setIsSavingNews(true);
    setNovedadGuardada("");
    try {
      const normalizedNews = buildNewsSnapshot(items);

      await persistSection("news", normalizedNews);
      setNewsDraft(normalizedNews);
      flashMessage(setNovedadGuardada, "Cambios de novedades guardados correctamente.");
      setNewsError("");
      openSaveModal("Los cambios de novedades se guardaron correctamente.");
    } catch (saveFailure) {
      setNewsError(
        saveFailure instanceof Error ? saveFailure.message : "No se pudieron guardar las novedades."
      );
    } finally {
      setIsSavingNews(false);
    }
  };

  const handleSaveNews = () => saveNews(newsDraft);

  const handleToggleSelectedNews = () => {
    if (!selectedNews) return;
    const nextNews = newsDraft.map((item) => item.id === selectedNews.id
      ? { ...item, published: item.published === false }
      : item);
    void saveNews(nextNews);
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
      <AdminGarage username={user} password={pass} />
      {saveConflict ? (
        <div className="error" role="alert">
          {saveConflict} Tus cambios permanecen en este formulario; copialos antes de recargar.
        </div>
      ) : null}
      {saveModalMessage ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSaveModalMessage("")}>
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-save-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <strong id="admin-save-modal-title">Cambios guardados</strong>
            <p>{saveModalMessage}</p>
            <button type="button" onClick={() => setSaveModalMessage("")}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

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
        <h2 className="section-title admin-title">Configuración <span>general</span></h2>
        <p className="small">Podés guardar un solo campo; los demás son opcionales. Si vaciás un campo configurado, su contenido se oculta cuando corresponde.</p>
        <div className="admin-form-grid">
          {settingFields.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`setting-${key}`}>{label}</label>
              <input id={`setting-${key}`} value={settingsDraft[key] ?? ""} onChange={(event) => setSetting(key, event.target.value)} />
              {(["logoUrl", "aboutImageUrl", "heroImage", "lodgingImageUrl"] as string[]).includes(key) ? (
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Subir ${label}`} onChange={(event) => void handleSettingImageFile(key as "logoUrl" | "aboutImageUrl" | "heroImage" | "lodgingImageUrl", event.target.files?.[0])} />
              ) : null}
            </div>
          ))}
        </div>
        {(["contactItems", "socialItems"] as const).map((field) => (
          <div key={field} className="admin-picker-block">
            <strong className="admin-picker-title">{field === "contactItems" ? "Teléfonos, correo y WhatsApp" : "Redes sociales"}</strong>
            {(settingsDraft[field] ?? []).map((item, index) => (
              <div className="admin-dual-row" key={`${field}-${index}`}>
                <input aria-label="Etiqueta" value={item.label} onChange={(event) => setSettingsDraft((current) => ({ ...current, [field]: (current[field] ?? []).map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry) }))} />
                <input aria-label="Valor o enlace" value={item.value} onChange={(event) => setSettingsDraft((current) => ({ ...current, [field]: (current[field] ?? []).map((entry, i) => i === index ? { ...entry, value: event.target.value } : entry) }))} />
                <button type="button" className="danger-btn" onClick={() => setSettingsDraft((current) => ({ ...current, [field]: (current[field] ?? []).filter((_, i) => i !== index) }))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="ghost-btn" onClick={() => setSettingsDraft((current) => ({ ...current, [field]: [...(current[field] ?? []), { label: "", value: "" }] }))}>Agregar</button>
            <button type="button" className="ghost-btn" onClick={() => setSettingsDraft((current) => ({ ...current, [field]: [] }))}>
              {field === "contactItems" ? "Ocultar todos los contactos" : "Ocultar todas las redes"}
            </button>
          </div>
        ))}
        <button type="button" onClick={async () => {
          try {
            await persistSection("settings", settingsDraft);
            setSettingsError("");
            flashMessage(setSettingsSaved, "Configuración guardada.");
          } catch (error) {
            setSettingsError(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
          }
        }}>Guardar configuración</button>
        <div className="success">{settingsSaved}</div>
        <div className="error">{settingsError}</div>
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
        <div className="success">{aboutSaved}</div>
        <div className="error">{aboutError}</div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="section-title admin-title">
            Gestionar <span>navbar</span>
          </h2>
          <div className="admin-photo-actions">
            <button type="button" className="ghost-btn" onClick={handleAddNavItem} disabled={isSavingNav}>
              Agregar item
            </button>
          </div>
        </div>
        <p className="admin-helper-text">
          El orden de esta lista es el orden del menú público. Usá Subir o Bajar y Guardar menú para publicarlo.
          Garage se administra desde esta misma lista.
          Puedes cambiar el texto y el link de cada opcion del menu. Usa rutas como `/#evento`,
          `/#contacto`, `/admin` o `/mi-nueva-pagina`. Si la ruta no existe todavia, Next mostrara
          el 404.
        </p>
        <div className="admin-event-form">
          {navDraft.map((item, index) => (
            <div className="admin-dual-row" key={item.id}>
              <input
                type="text"
                placeholder="Texto del item"
                value={item.label}
                disabled={isSavingNav}
                onChange={(event) => updateNavItem(index, "label", event.target.value)}
              />
              <input
                type="text"
                placeholder="/ruta-nueva o /#seccion"
                value={item.href}
                disabled={isSavingNav}
                onChange={(event) => updateNavItem(index, "href", event.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={item.visible !== false}
                  disabled={isSavingNav}
                  onChange={(event) => updateNavItem(index, "visible", event.target.checked)}
                />
                Visible
              </label>
              <button type="button" className="ghost-btn" onClick={() => moveNavItem(index, -1)} disabled={isSavingNav || index === 0} aria-label={`Subir ${item.label}`}>
                Subir
              </button>
              <button type="button" className="ghost-btn" onClick={() => moveNavItem(index, 1)} disabled={isSavingNav || index === navDraft.length - 1} aria-label={`Bajar ${item.label}`}>
                Bajar
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => handleRemoveNavItem(index)}
                disabled={isSavingNav}
              >
                Quitar
              </button>
            </div>
          ))}

          <button type="button" onClick={handleSaveNavItems} disabled={isSavingNav}>
            Guardar menu
          </button>
          <div className="success" role="status">{navSaved}</div>
          <div className="error" role="alert">{navError}</div>
        </div>
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
              disabled={!selectedEvent}
            >
              Eliminar evento
            </button>
          </div>
        </div>

        <label htmlFor="featured-event">Evento destacado en portada</label>
        <select
          id="featured-event"
          value={featuredEventDraftId}
          onChange={(event) => setFeaturedEventDraftId(event.target.value)}
        >
          <option value="">Seleccionar automáticamente</option>
          {eventsDraft.filter((event) => event.published !== false).map((event) => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>

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
                <label htmlFor="event-published">Publicación</label>
                <select
                  id="event-published"
                  value={selectedEvent.published === false ? "hidden" : "published"}
                  onChange={(event) => {
                    const published = event.target.value === "published";
                    updateSelectedEventField("published", published);
                    if (!published && featuredEventDraftId === selectedEvent.id) {
                      setFeaturedEventDraftId(eventsDraft.find((item) => item.id !== selectedEvent.id && item.published !== false)?.id ?? "");
                    }
                  }}
                >
                  <option value="published">Publicado</option>
                  <option value="hidden">Oculto</option>
                </select>
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
                <strong className="admin-picker-title">Dias del evento</strong>
                <button type="button" className="ghost-btn" onClick={addDayItem}>
                  Agregar dia
                </button>
              </div>
              {selectedEvent.dayItems.map((item, index) => (
                <div className="admin-stack-field" key={`day-${index}`}>
                  <div className="admin-dual-row">
                    <input
                      type="text"
                      placeholder="Dia"
                      value={item.day}
                      onChange={(event) => updateDayItem(index, "day", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Descripcion del dia"
                      value={item.detail}
                      onChange={(event) => updateDayItem(index, "detail", event.target.value)}
                    />
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => removeDayItem(index)}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="admin-dual-row admin-dual-row--media">
                    <input
                      type="text"
                      placeholder="URL de la foto del dia"
                      value={item.imageUrl || ""}
                      onChange={(event) => updateDayItem(index, "imageUrl", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Texto alternativo de la foto"
                      value={item.imageAlt || ""}
                      onChange={(event) => updateDayItem(index, "imageAlt", event.target.value)}
                    />
                  </div>
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
        ) : (
          <div className="admin-event-form">
            <p className="small">No hay eventos cargados. Guardá los cambios para confirmar la eliminación.</p>
            <button type="button" onClick={handleSaveEvents}>Guardar eventos</button>
            <div className="error">{fotoError}</div>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="section-title admin-title">
            Gestionar <span>novedades</span>
          </h2>
          <div className="admin-photo-actions">
            <button type="button" className="ghost-btn" onClick={handleAddNews} disabled={isSavingNews}>
              Crear novedad
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={handleRemoveSelectedNews}
              disabled={!selectedNews || isSavingNews}
            >
              Eliminar novedad
            </button>
          </div>
        </div>
        <p className="admin-helper-text">
          Carga una novedad de forma simple: crear, subir foto, escribir la descripcion y guardar.
          Elegí si se publica o queda oculta antes de guardar.
        </p>

        {selectedNews ? (
          <div className="admin-event-form">
            <div className="admin-preview-card">
              <div className="admin-preview-head">
                <strong className="admin-picker-title">Novedades cargadas</strong>
                <button type="button" onClick={handleSaveNews} disabled={isSavingNews}>
                  Guardar novedades
                </button>
              </div>
              <div className="admin-news-preview-grid">
                {newsPreviewItems.map((item, index) => (
                  <button
                    key={`preview-${item.id}`}
                    type="button"
                    className={`admin-news-preview-card ${
                      item.id === selectedNews.id ? "is-selected" : ""
                    }`}
                    onClick={() => setSelectedNewsId(item.id)}
                  >
                    <div className="admin-news-preview-image">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.imageAlt || item.title || "Novedad"}
                          loading="lazy"
                        />
                      ) : (
                        <div className="admin-news-preview-empty">Sin imagen</div>
                      )}
                    </div>
                    <div className="admin-news-preview-copy">
                      <div className="admin-news-preview-meta">
                        <span>{index === 0 ? "Se vera primero" : `Posicion ${index + 1}`}</span>
                        <span>{item.date || "Sin fecha visible"}</span>
                      </div>
                      <strong>{item.title || "Nueva novedad"}</strong>
                      <p>{item.description || "Completa la descripcion para ver la tarjeta final."}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-photo-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => newsFileInputRef.current?.click()}
                disabled={isUploadingNewsImage}
              >
                {isUploadingNewsImage ? "Subiendo imagen..." : "Subir foto de la novedad"}
              </button>
            </div>

            <input
              ref={newsFileInputRef}
              type="file"
          accept="image/jpeg,image/png,image/webp"
              className="sr-only-input"
              onChange={handleNewsLocalFileChange}
            />

            <div className="admin-form-grid">
              <div>
                <label htmlFor="news-title">Título</label>
                <input id="news-title" value={selectedNews.title} onChange={(event) => updateSelectedNewsField("title", event.target.value)} />
              </div>
              <div>
                <label htmlFor="news-tag">Etiqueta</label>
                <input id="news-tag" value={selectedNews.tag} onChange={(event) => updateSelectedNewsField("tag", event.target.value)} />
              </div>
              <div>
                <label htmlFor="news-image-url">URL de imagen</label>
                <input id="news-image-url" value={selectedNews.imageUrl} onChange={(event) => updateSelectedNewsField("imageUrl", event.target.value)} />
              </div>
            </div>

            {selectedNews.imageUrl ? (
              <div className="admin-preview-card">
                <strong className="admin-picker-title">Vista previa de la foto subida</strong>
                <div className="admin-preview-frame">
                  <img
                    src={selectedNews.imageUrl}
                    alt={selectedNews.imageAlt || "Vista previa"}
                    loading="lazy"
                  />
                </div>
              </div>
            ) : null}

            <div className="admin-form-grid">
              <div>
                <label htmlFor="news-alt">Texto alternativo</label>
                <input
                  id="news-alt"
                  type="text"
                  placeholder="Ejemplo: Foto de la rodada"
                  value={selectedNews.imageAlt}
                  onChange={(event) => updateSelectedNewsField("imageAlt", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="news-published">Publicación</label>
                <select
                  id="news-published"
                  value={selectedNews.published === false ? "hidden" : "published"}
                  onChange={(event) => updateSelectedNewsField("published", event.target.value === "published")}
                >
                  <option value="published">Publicada</option>
                  <option value="hidden">Oculta</option>
                </select>
                <button type="button" className="ghost-btn" onClick={handleToggleSelectedNews} disabled={isSavingNews}>
                  {selectedNews.published === false ? "Publicar novedad" : "Ocultar novedad"}
                </button>
              </div>
            </div>

            <label htmlFor="news-description">Descripcion</label>
            <textarea
              id="news-description"
              placeholder="Escribe la novedad..."
              value={selectedNews.description}
              onChange={(event) => updateSelectedNewsField("description", event.target.value)}
            />

            <button type="button" onClick={handleSaveNews} disabled={isSavingNews}>
              Guardar novedades
            </button>
          </div>
        ) : (
          <div className="admin-event-form">
            <p className="small">No hay novedades cargadas.</p>
            <button type="button" onClick={handleSaveNews} disabled={isSavingNews}>Guardar novedades</button>
          </div>
        )}
        <div className="success" role="status">{novedadGuardada}</div>
        <div className="error" role="alert">{newsError}</div>
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
          {!cloudinaryEnabled ? (
            <button type="button" className="ghost-btn" onClick={handleOpenWebSearch}>
              Buscar en la web
            </button>
          ) : null}
          <button type="button" className="ghost-btn" onClick={resetPhotoForm}>
            Limpiar seleccion
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only-input"
          onChange={handleLocalFileChange}
        />

        {!cloudinaryEnabled ? (
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
        ) : null}

        <label htmlFor="nueva-foto-url">
          {cloudinaryEnabled && editingPhotoIndex === null ? "Archivo seleccionado" : "URL, ruta interna o imagen subida"}
        </label>
        <input
          id="nueva-foto-url"
          type="text"
          placeholder={
            cloudinaryEnabled
              ? "Seleccioná un archivo JPG, PNG o WebP de hasta 4 MB"
              : "/assets/nueva-imagen.jpg, https://... o archivo local"
          }
          value={fotoUrl}
          readOnly={cloudinaryEnabled && editingPhotoIndex === null}
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
          {isUploadingPhoto ? "Subiendo imagen..." : editingPhotoIndex !== null ? "Guardar fotografía" : cloudinaryEnabled ? "Subir a Cloudinary" : "Agregar imagen"}
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
                <button type="button" className="ghost-btn" onClick={() => {
                  setEditingPhotoIndex(index);
                  setSelectedFile(null);
                  setFotoUrl(foto.url);
                  setFotoTitulo(foto.titulo);
                  setFotoDescripcion(foto.descripcion);
                  setFotoError("");
                }}>Editar o reemplazar</button>
                <button type="button" className="ghost-btn" onClick={async () => {
                  try {
                    await persistSection("photos", content.fotos.map((item, i) => i === index ? { ...item, published: item.published === false } : item));
                    setFotoError("");
                    flashMessage(setFotoGuardada, foto.published === false ? "Fotografía publicada." : "Fotografía oculta.");
                  } catch (error) {
                    setFotoError(error instanceof Error ? error.message : "No se pudo cambiar la publicación.");
                  }
                }}>{foto.published === false ? "Publicar" : "Ocultar"}</button>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => handleEliminarFotoActual(foto, index)}
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
