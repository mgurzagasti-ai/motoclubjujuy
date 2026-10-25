"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { GARAGE_MAX_PHOTOS, garageDefaultCategories, validateGarageDraft, type GarageCategory, type GarageDraft, type GarageListing, type GarageStatus } from "@/lib/garage";

type GarageMember = { user_id: string; email: string | null; emailConfirmed: boolean;
  status: "pending" | "approved" | "rejected"; requested_at: string; reviewed_at: string | null };

export function AdminGarage({ username, password }: { username: string; password: string }) {
  const [listings, setListings] = useState<GarageListing[]>([]);
  const [categories, setCategories] = useState<GarageCategory[]>([]);
  const [members, setMembers] = useState<GarageMember[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<GarageDraft | null>(null);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const auth = () => {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    return { Authorization: `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))}` };
  };
  const load = async () => {
    const headers = auth();
    const [items, groups] = await Promise.all([
      fetch("/api/admin/garage", { headers }),
      fetch("/api/admin/garage/categories", { headers }),
    ]);
    const itemBody = await items.json(); const groupBody = await groups.json();
    if (!items.ok || !groups.ok) throw new Error(itemBody.error || groupBody.error || "No se pudo cargar Garage.");
    setListings(itemBody.listings); setCategories(groupBody.categories);
  };
  const loadMembers = async (page: number) => {
    const response = await fetch(`/api/admin/garage/members?page=${page}`, { headers: auth() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No se pudieron cargar las solicitudes.");
    setMembers(body.members); setMemberTotal(body.total);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((failure) => setError(failure.message));
      void loadMembers(memberPage).catch((failure) => setError(failure.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (memberPage === 1) return;
    const timer = window.setTimeout(() => void loadMembers(memberPage).catch((failure) => setError(failure.message)), 0);
    return () => window.clearTimeout(timer);
  }, [memberPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (path: string, method: string, body: unknown) => {
    const response = await fetch(path, { method,
      headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo guardar.");
    return result;
  };
  const updateStatus = async (item: GarageListing, status: GarageStatus) => {
    setBusy(true); setError(""); setNotice("");
    try { await send("/api/admin/garage", "PATCH", { id: item.id, status, expectedUpdatedAt: item.updated_at }); await load(); setNotice(`Anuncio ${status}.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo moderar."); }
    finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!editing || !draft) return;
    const valid = validateGarageDraft(draft);
    if (!valid.ok) { setError(valid.error); return; }
    setBusy(true); setError(""); setNotice("");
    const original = listings.find((item) => item.id === editing);
    if (!original) { setError("Actualizá la lista de anuncios."); return; }
    try { await send("/api/admin/garage", "PATCH", { id: editing, draft: valid.draft, expectedUpdatedAt: original.updated_at }); await load(); setEditing(null); setDraft(null); setNotice("Edición guardada. Requiere aprobación."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo editar."); }
    finally { setBusy(false); }
  };
  const remove = async (item: GarageListing) => {
    if (!window.confirm(`¿Eliminar definitivamente "${item.title}"?`)) return;
    setBusy(true); setError("");
    try { await send("/api/admin/garage", "DELETE", { id: item.id, expectedUpdatedAt: item.updated_at }); await load(); setNotice("Anuncio eliminado."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo eliminar."); }
    finally { setBusy(false); }
  };
  const saveCategory = async (value: GarageCategory) => {
    setBusy(true); setError("");
    try { await send("/api/admin/garage/categories", "PUT", value); await load(); setNotice("Categoría guardada."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo guardar la categoría."); }
    finally { setBusy(false); }
  };
  const removeCategory = async (item: GarageCategory) => {
    if (!window.confirm(`¿Eliminar categoría "${item.label}"?`)) return;
    setBusy(true); setError("");
    try { await send("/api/admin/garage/categories", "DELETE", { slug: item.slug }); await load(); setNotice("Categoría eliminada."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo eliminar."); }
    finally { setBusy(false); }
  };
  const decideMember = async (member: GarageMember, status: "approved" | "rejected") => {
    setBusy(true); setError(""); setNotice("");
    try {
      await send("/api/admin/garage/members", "PATCH", { userId: member.user_id, status,
        expectedStatus: member.status, expectedReviewedAt: member.reviewed_at });
      await loadMembers(memberPage);
      setNotice(status === "approved" ? "Miembro autorizado para publicar." : "Permiso de publicación rechazado o revocado.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo revisar la membresía."); }
    finally { setBusy(false); }
  };
  const uploadPhoto = async (id: string, file: File | undefined) => {
    if (!file || !draft) return;
    if (draft.images.length >= GARAGE_MAX_PHOTOS) { setError(`Máximo ${GARAGE_MAX_PHOTOS} fotos.`); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Solo JPG, PNG o WebP de hasta 4 MB."); return;
    }
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("id", id); form.set("file", file);
      const response = await fetch("/api/admin/garage", { method: "POST", headers: auth(), body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo subir la foto.");
      setDraft((current) => current ? { ...current, images: [...current.images, result.url] } : current);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo subir la foto."); }
    finally { setBusy(false); }
  };

  return <section className="admin-section" id="admin-garage">
    <h2 className="section-title admin-title">ADMIN <span>Garage</span></h2>
    <p>Los anuncios pendientes no aparecen en la web pública. Aprobalos después de revisarlos.</p>
    <h3>Solicitudes de miembros</h3>
    <p>Registrarse no habilita publicaciones. Revisá la identidad antes de aprobar el acceso.</p>
    <div className="garage-admin-categories">{members.map((member) => <div key={member.user_id}>
      <strong>{member.email || "Cuenta sin correo"}</strong>
      <small>{member.user_id} · Solicitó: {new Date(member.requested_at).toLocaleString("es-AR")}</small>
      <span>{member.status} {member.emailConfirmed ? "· correo confirmado" : "· correo sin confirmar"}</span>
      {member.status !== "approved" ? <button type="button" disabled={busy || !member.emailConfirmed} onClick={() => void decideMember(member, "approved")}>Autorizar</button> : null}
      {member.status !== "rejected" ? <button type="button" className="danger-btn" disabled={busy} onClick={() => void decideMember(member, "rejected")}>Rechazar / revocar</button> : null}
    </div>)}</div>
    {members.length === 0 ? <p>Sin solicitudes en esta página.</p> : null}
    <div className="admin-photo-actions">
      <button type="button" className="ghost-btn" disabled={memberPage <= 1} onClick={() => setMemberPage((page) => page - 1)}>Anterior</button>
      <span>Página {memberPage} · {memberTotal} solicitudes</span>
      <button type="button" className="ghost-btn" disabled={memberPage * 25 >= memberTotal} onClick={() => setMemberPage((page) => page + 1)}>Siguiente</button>
    </div>
    <button type="button" className="ghost-btn" onClick={() => {
      void load().catch((failure) => setError(failure.message));
      void loadMembers(memberPage).catch((failure) => setError(failure.message));
    }}>Actualizar Garage</button>
    <div className="garage-admin-list">{listings.map((item) => <article key={item.id} className="garage-admin-card">
      {item.images[0] ? <img src={item.images[0]} alt={item.title} loading="lazy" /> : null}
      <div><strong>{item.title}</strong><p>{item.description}</p>
        <p>Estado: {item.status} · Categoría: {item.category_slug} · Precio: {item.price ?? "Consultar"}</p>
        <small>Propietario (UID Supabase): {item.owner_id} · WhatsApp: {item.whatsapp} · Enviado: {new Date(item.submitted_at).toLocaleString("es-AR")} · Creado: {new Date(item.created_at).toLocaleString("es-AR")}</small>
        <div className="admin-photo-actions">
          <button type="button" disabled={busy} onClick={() => void updateStatus(item, "approved")}>Aprobar</button>
          <button type="button" disabled={busy} onClick={() => void updateStatus(item, "rejected")}>Rechazar</button>
          <button type="button" disabled={busy} onClick={() => void updateStatus(item, "hidden")}>Ocultar</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(item.id); setDraft({ title: item.title, description: item.description, category_slug: item.category_slug, price: item.price, whatsapp: item.whatsapp, images: item.images }); }}>Editar</button>
          <button type="button" className="danger-btn" disabled={busy} onClick={() => void remove(item)}>Eliminar</button>
        </div>
        {editing === item.id && draft ? <div className="garage-form">
          <label>Título<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Descripción<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Categoría<select value={draft.category_slug} onChange={(event) => setDraft({ ...draft, category_slug: event.target.value })}>
            {categories.map((group) => <option key={group.slug} value={group.slug}>{group.label}</option>)}
          </select></label>
          <label>Precio<input type="number" min="0" value={draft.price ?? ""} onChange={(event) => setDraft({ ...draft, price: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>WhatsApp<input value={draft.whatsapp} onChange={(event) => setDraft({ ...draft, whatsapp: event.target.value })} /></label>
          <div className="garage-previews">{draft.images.map((url) => <div key={url}><img src={url} alt="Foto del anuncio" />
            <button type="button" onClick={() => setDraft({ ...draft, images: draft.images.filter((image) => image !== url) })}>Quitar</button></div>)}</div>
          <label>Agregar foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={(event) => { void uploadPhoto(item.id, event.target.files?.[0]); event.target.value = ""; }} /></label>
          <button type="button" disabled={busy} onClick={() => void saveEdit()}>Guardar edición</button>
          <button type="button" className="ghost-btn" onClick={() => { setEditing(null); setDraft(null); }}>Cancelar</button>
        </div> : null}
      </div>
    </article>)}</div>
    {listings.length === 0 ? <p>Sin anuncios todavía.</p> : null}
    <h3>Categorías</h3>
    <div className="garage-admin-categories">{categories.map((item) => <div key={item.slug}>
      <strong>{item.label}</strong> <small>({item.slug})</small> <span>{item.active ? "Activa" : "Oculta"}</span>
      <button type="button" disabled={busy} onClick={() => void saveCategory({ ...item, active: !item.active })}>{item.active ? "Ocultar" : "Activar"}</button>
      <button type="button" className="danger-btn" disabled={busy} onClick={() => void removeCategory(item)}>Eliminar</button>
    </div>)}</div>
    <div className="admin-dual-row"><input aria-label="Slug de categoría" placeholder="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
      <input aria-label="Nombre de categoría" placeholder="Nombre" value={label} onChange={(event) => setLabel(event.target.value)} />
      <button type="button" disabled={busy} onClick={() => void saveCategory({ slug, label, active: true }).then(() => { setSlug(""); setLabel(""); })}>Agregar / renombrar</button></div>
    <p className="small">Categorías iniciales: {garageDefaultCategories.map((item) => item.label).join(", ")}.</p>
    {error ? <div className="error" role="alert">{error}</div> : null}{notice ? <div className="success" role="status">{notice}</div> : null}
  </section>;
}
