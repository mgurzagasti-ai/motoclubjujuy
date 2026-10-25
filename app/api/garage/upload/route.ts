import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { garageMemberApproved, memberContext } from "@/lib/garage-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { MAX_PHOTO_BYTES, validatePhotoFile } from "@/lib/photo-security";
import { GARAGE_MAX_UPLOADS_PER_HOUR } from "@/lib/garage";
import { storeGaragePhoto } from "@/lib/garage-storage";

export async function POST(request: Request) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión para subir fotos." }, { status: 401 });
  if (!await garageMemberApproved(context))
    return NextResponse.json({ error: "ADMIN debe aprobar tu membresía de Garage antes de subir fotos." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return NextResponse.json({ error: "Se esperaba una foto." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES + 128 * 1024)
    return NextResponse.json({ error: "La foto supera 4 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "No se pudo leer la foto." }, { status: 400 }); }
  const file = form.get("file");
  if (form.getAll("file").length !== 1 || !(file instanceof File))
    return NextResponse.json({ error: "Seleccioná una foto." }, { status: 400 });
  const fileError = await validatePhotoFile(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin.from("garage_uploads")
    .select("id", { count: "exact", head: true }).eq("owner_id", context.user.id).gte("created_at", since);
  if (countError) return NextResponse.json({ error: "No se pudo comprobar el límite de fotos." }, { status: 500 });
  if ((count || 0) >= GARAGE_MAX_UPLOADS_PER_HOUR)
    return NextResponse.json({ error: "Alcanzaste el límite de fotos por hora." }, { status: 429 });
  // Reservar cupo antes de llamar a Cloudinary; el trigger SQL serializa cargas concurrentes.
  const reservationKey = randomUUID();
  const { data: reservation, error: reservationError } = await admin.from("garage_uploads")
    .insert({ owner_id: context.user.id, url: `https://garage-upload.invalid/${reservationKey}`,
      provider: "pending", storage_key: reservationKey }).select("id").single();
  if (reservationError || !reservation)
    return NextResponse.json({ error: reservationError?.message.includes("garage_upload_limit")
      ? "Alcanzaste el límite de fotos por hora." : "No se pudo reservar la carga." },
    { status: reservationError?.message.includes("garage_upload_limit") ? 429 : 500 });
  try {
    const photo = await storeGaragePhoto(file, context.user.id);
    const { error } = await admin.from("garage_uploads")
      .update({ url: photo.url, provider: photo.provider, storage_key: photo.storageKey }).eq("id", reservation.id);
    if (error) {
      await admin.from("garage_uploads").delete().eq("id", reservation.id);
      return NextResponse.json({ error: "La foto se subió pero no pudo registrarse. Intentá nuevamente." }, { status: 500 });
    }
    return NextResponse.json({ url: photo.url }, { status: 201 });
  } catch (error) {
    await admin.from("garage_uploads").delete().eq("id", reservation.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo subir la foto." }, { status: 502 });
  }
}
