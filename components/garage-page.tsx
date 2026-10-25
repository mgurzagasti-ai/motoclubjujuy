"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { GARAGE_MAX_PHOTOS, garageWhatsappHref, validateGarageDraft, type GarageCategory, type GarageDraft, type GarageListing } from "@/lib/garage";

const emptyDraft: GarageDraft = { title: "", description: "", category_slug: "", price: null, whatsapp: "", images: [] };
type PublicListing = Omit<GarageListing, "owner_id" | "updated_at" | "submitted_at" | "status">;
type GarageMembership = { status: "pending" | "approved" | "rejected"; requested_at: string; reviewed_at: string | null };

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación.");
  return body;
}

export function GaragePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [mine, setMine] = useState<GarageListing[]>([]);
  const [membership, setMembership] = useState<GarageMembership | null>(null);
  const [membershipUserId, setMembershipUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<GarageCategory[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<GarageDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPublic, setLoadingPublic] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    void fetch("/api/garage/categories").then(readJson).then((body) => setCategories(body.categories)).catch((failure) => setError(failure.message));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/garage?${params}`, { signal: controller.signal })
        .then(readJson).then((body) => setListings(body.listings))
        .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
        .finally(() => { if (!controller.signal.aborted) setLoadingPublic(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, category]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMine([]);
      if (!session) return;
      void fetch("/api/garage/mine", { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal })
        .then(readJson).then((body) => setMine(body.listings))
        .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMembership(null); setMembershipUserId(null);
      if (!session) return;
      void fetch("/api/garage/membership", { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal })
        .then(readJson).then((body) => { setMembership(body.membership); setMembershipUserId(session.user.id); })
        .catch((failure) => { if (!controller.signal.aborted) { setError(failure.message); setMembershipUserId(session.user.id); } });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [session]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    const timer = window.setTimeout(() => setPreviews(urls), 0);
    return () => { window.clearTimeout(timer); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [files]);

  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.slug, item.label])), [categories]);
  const refreshMine = async (token: string) => {
    const body = await readJson(await fetch("/api/garage/mine", { headers: { Authorization: `Bearer ${token}` } }));
    setMine(body.listings);
  };
  const refreshPublic = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    const body = await readJson(await fetch(`/api/garage?${params}`));
    setListings(body.listings);
  };
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!supabase) { setError("Supabase Auth no está configurado."); return; }
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password,
        options: { emailRedirectTo: `${window.location.origin}/garage` } });
    if (result.error) setError(result.error.message);
    else setNotice(authMode === "register" && !result.data.session
      ? "Revisá tu correo para confirmar la cuenta. Luego solicitá acceso a Garage; el registro no otorga permisos de ADMIN."
      : "Sesión iniciada. Para publicar, necesitás autorización de ADMIN y cada anuncio requiere aprobación.");
    setPassword("");
  };
  const requestMembership = async () => {
    if (!session) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const body = await readJson(await fetch("/api/garage/membership", {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}` },
      }));
      setMembership(body.membership); setMembershipUserId(session.user.id);
      setNotice("Solicitud enviada. ADMIN debe autorizarte antes de publicar.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo enviar la solicitud."); }
    finally { setBusy(false); }
  };
  const selectFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length + draft.images.length > GARAGE_MAX_PHOTOS) {
      setError(`Máximo ${GARAGE_MAX_PHOTOS} fotos por anuncio.`); return;
    }
    if (next.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      setError("Solo JPG, PNG o WebP de hasta 4 MB por foto."); return;
    }
    setFiles(next); setError("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!session) { setError("Iniciá sesión."); return; }
    if (draft.images.length + files.length < 1) { setError("Adjuntá al menos una foto."); return; }
    const preliminary = validateGarageDraft({ ...draft, images: [...draft.images, ...files.map((_, index) => `https://garage.local/preview-${index}`)] });
    if (!preliminary.ok) { setError(preliminary.error); return; }
    setBusy(true);
    const images = [...draft.images];
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const form = new FormData(); form.set("file", file);
        const response = await fetch("/api/garage/upload", {
          method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form,
        });
        images.push((await readJson(response)).url);
        uploadedCount += 1;
      }
      if (uploadedCount) { setDraft({ ...draft, images }); setFiles([]); }
      const candidate = { ...draft, images, expectedUpdatedAt: editingId ? mine.find((item) => item.id === editingId)?.updated_at : undefined };
      const valid = validateGarageDraft(candidate);
      if (!valid.ok) throw new Error(valid.error);
      await readJson(await fetch(editingId ? `/api/garage/mine/${editingId}` : "/api/garage/mine", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...valid.draft, expectedUpdatedAt: candidate.expectedUpdatedAt }),
      }));
      setNotice("Anuncio enviado. Quedará pendiente hasta que ADMIN lo apruebe.");
      setDraft(emptyDraft); setFiles([]); setEditingId(null);
      await refreshMine(session.access_token); await refreshPublic();
    } catch (failure) {
      if (uploadedCount) { setDraft({ ...draft, images }); setFiles(files.slice(uploadedCount)); }
      setError(failure instanceof Error ? failure.message : "No se pudo guardar.");
    }
    finally { setBusy(false); }
  };
  const startEdit = (item: GarageListing) => {
    setEditingId(item.id);
    setDraft({ title: item.title, description: item.description, category_slug: item.category_slug,
      price: item.price, whatsapp: item.whatsapp, images: item.images });
    setFiles([]); setError(""); setNotice("");
    document.getElementById("garage-form")?.scrollIntoView({ behavior: "smooth" });
  };
  const changeMine = async (item: GarageListing, action: "sold" | "delete") => {
    if (!session) return;
    if (action === "delete" && !window.confirm(`¿Eliminar "${item.title}"?`)) return;
    setBusy(true); setError("");
    try {
      await readJson(await fetch(`/api/garage/mine/${item.id}`, {
        method: action === "sold" ? "PATCH" : "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: item.updated_at }),
      }));
      await refreshMine(session.access_token); await refreshPublic();
      setNotice(action === "sold" ? "Anuncio marcado como vendido." : "Anuncio eliminado.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  };
  const canPublish = Boolean(session && membershipUserId === session.user.id && membership?.status === "approved");

  return <section className="garage-page">
    <header className="garage-heading"><h1>Garage</h1><p>Artículos de miembros del club. Solo se muestran anuncios aprobados.</p></header>
    <div className="garage-filters">
      <input aria-label="Buscar publicaciones" placeholder="Buscar motos, repuestos..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Todas las categorías</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
      </select>
    </div>
    <div className="garage-grid">{listings.map((item) => <article className="garage-card" key={item.id}>
      {item.images?.[0] ? <img src={item.images[0]} alt={item.title} loading="lazy" /> : null}
      <div><small>{categoryNames.get(item.category_slug) || item.category_slug}</small><h2>{item.title}</h2>
        <p>{item.description}</p>{item.price !== null ? <strong>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(item.price)}</strong> : <span>Consultar precio</span>}
        {garageWhatsappHref(item.whatsapp) ? <a href={garageWhatsappHref(item.whatsapp)!} target="_blank" rel="noreferrer">Consultar por WhatsApp</a> : null}
      </div>
    </article>)}</div>
    {!loadingPublic && listings.length === 0 ? <p>No hay publicaciones aprobadas para esta búsqueda.</p> : null}
    <section className="garage-member"><h2>Mi Garage</h2>
      {!session ? <form onSubmit={signIn} className="garage-form">
        <h3>{authMode === "login" ? "Ingresar" : "Crear cuenta"}</h3>
        <label>Correo<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit">{authMode === "login" ? "Ingresar" : "Registrarme"}</button>
        <button type="button" className="ghost-btn" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
          {authMode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}</button>
      </form> : <>
        <p>Sesión: {session.user.email} <button type="button" className="ghost-btn" onClick={() => void supabase?.auth.signOut()}>Salir</button></p>
        {membershipUserId !== session.user.id ? <p>Consultando tu permiso de Garage...</p>
          : membership?.status === "pending" ? <p>Tu solicitud de acceso está pendiente de autorización por ADMIN.</p>
          : membership?.status === "rejected" ? <p>Tu solicitud fue rechazada o tu permiso fue revocado. Contactá al club.</p>
          : !membership ? <div><p>Para publicar necesitás autorización del club.</p>
            <button type="button" disabled={busy} onClick={() => void requestMembership()}>Solicitar acceso a Garage</button></div> : null}
        <div className="garage-mine"><h3>Mis publicaciones</h3>{mine.map((item) => <article key={item.id}>
          <strong>{item.title}</strong> <span>{item.status}</span> <small>{new Date(item.created_at).toLocaleDateString("es-AR")}</small>
          {canPublish ? <button type="button" onClick={() => startEdit(item)}>Editar</button> : null}
          {canPublish && item.status === "approved" ? <button type="button" onClick={() => void changeMine(item, "sold")} disabled={busy}>Marcar vendido</button> : null}
          <button type="button" className="danger-btn" onClick={() => void changeMine(item, "delete")} disabled={busy}>Eliminar</button>
        </article>)}{mine.length === 0 ? <p>Todavía no publicaste artículos.</p> : null}</div>
        {canPublish ? <form id="garage-form" className="garage-form" onSubmit={save}><h3>{editingId ? "Editar anuncio" : "Publicar artículo"}</h3>
          <label>Título<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Descripción<textarea required maxLength={3000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Categoría<select required value={draft.category_slug} onChange={(event) => setDraft({ ...draft, category_slug: event.target.value })}>
            <option value="">Elegir categoría</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
          </select></label>
          <label>Precio opcional (ARS)<input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(event) => setDraft({ ...draft, price: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>WhatsApp con código de país<input required type="tel" value={draft.whatsapp} onChange={(event) => setDraft({ ...draft, whatsapp: event.target.value })} /></label>
          <label>Fotos (1 a {GARAGE_MAX_PHOTOS}, JPG/PNG/WebP, 4 MB cada una)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /></label>
          <div className="garage-previews">{draft.images.map((url) => <div key={url}><img src={url} alt="Foto cargada" />
            <button type="button" onClick={() => setDraft({ ...draft, images: draft.images.filter((item) => item !== url) })}>Quitar</button></div>)}
            {previews.map((url, index) => <div key={url}><img src={url} alt={`Vista previa ${index + 1}`} />
              <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))}>Quitar</button></div>)}</div>
          <p>Podés revisar las fotos antes de enviar. Todo anuncio nuevo o editado queda pendiente de aprobación.</p>
          <button type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar para aprobación"}</button>
          {editingId ? <button type="button" className="ghost-btn" onClick={() => { setEditingId(null); setDraft(emptyDraft); setFiles([]); }}>Cancelar edición</button> : null}
        </form> : null}
      </>}
      {error ? <p className="error" role="alert">{error}</p> : null}{notice ? <p className="success" role="status">{notice}</p> : null}
    </section>
  </section>;
}
