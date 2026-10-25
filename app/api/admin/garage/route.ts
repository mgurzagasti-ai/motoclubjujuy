import { NextResponse } from "next/server";
import { garageAdminContext } from "@/lib/garage-auth";
import { validateGarageDraft, type GarageStatus } from "@/lib/garage";
import { MAX_PHOTO_BYTES, validatePhotoFile } from "@/lib/photo-security";
import { storeGaragePhoto } from "@/lib/garage-storage";

const allowedStatuses: GarageStatus[] = ["pending", "approved", "rejected", "hidden", "sold"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await admin.from("garage_listings").select("*")
    .order("submitted_at", { ascending: false }).limit(150);
  if (error) return NextResponse.json({ error: "No se pudieron cargar los anuncios." }, { status: 500 });
  return NextResponse.json({ listings: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return NextResponse.json({ error: "Se esperaba una foto." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 128 * 1024)
    return NextResponse.json({ error: "La foto supera 4 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "No se pudo leer la foto." }, { status: 400 }); }
  const id = form.get("id");
  const file = form.get("file");
  if (typeof id !== "string" || !uuid.test(id) || form.getAll("file").length !== 1 || !(file instanceof File))
    return NextResponse.json({ error: "Anuncio o foto inválidos." }, { status: 400 });
  const fileError = await validatePhotoFile(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  const { data: listing, error: lookupError } = await admin.from("garage_listings")
    .select("owner_id").eq("id", id).maybeSingle();
  if (lookupError || !listing) return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });
  try {
    const photo = await storeGaragePhoto(file, listing.owner_id);
    const { error } = await admin.from("garage_uploads")
      .insert({ owner_id: listing.owner_id, url: photo.url, provider: photo.provider, storage_key: photo.storageKey });
    if (error) return NextResponse.json({ error: "La foto se subió pero no pudo registrarse." }, { status: 500 });
    return NextResponse.json({ url: photo.url }, { status: 201 });
  } catch (failure) {
    return NextResponse.json({ error: failure instanceof Error ? failure.message : "No se pudo subir la foto." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body || typeof body.id !== "string" || !uuid.test(body.id))
    return NextResponse.json({ error: "Anuncio inválido." }, { status: 400 });
  if (typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
    return NextResponse.json({ error: "Falta la versión actual del anuncio." }, { status: 400 });
  const changes: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!allowedStatuses.includes(body.status as GarageStatus))
      return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    changes.status = body.status;
    changes.moderated_at = new Date().toISOString();
  }
  if (body.draft !== undefined) {
    const valid = validateGarageDraft(body.draft);
    if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
    Object.assign(changes, valid.draft);
    // Una edición administrativa también exige una aprobación explícita posterior.
    changes.status = "pending";
    changes.moderated_at = null;
  }
  if (!Object.keys(changes).length) return NextResponse.json({ error: "No hay cambios." }, { status: 400 });
  changes.updated_at = new Date().toISOString();
  const { data, error } = await admin.from("garage_listings").update(changes)
    .eq("id", body.id).eq("updated_at", body.expectedUpdatedAt).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo actualizar el anuncio." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "El anuncio cambió o ya no está disponible. Actualizá la lista." }, { status: 409 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: { id?: string; expectedUpdatedAt?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body?.id || !uuid.test(body.id)) return NextResponse.json({ error: "Anuncio inválido." }, { status: 400 });
  if (typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
    return NextResponse.json({ error: "Falta la versión actual del anuncio." }, { status: 400 });
  const { data, error } = await admin.from("garage_listings").delete()
    .eq("id", body.id).eq("updated_at", body.expectedUpdatedAt).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo eliminar el anuncio." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "El anuncio cambió o ya no está disponible. Actualizá la lista." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
