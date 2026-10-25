import { NextResponse } from "next/server";
import { garageMemberApproved, memberContext } from "@/lib/garage-auth";
import { validateGarageDraft } from "@/lib/garage";
import { validateGarageReferences } from "@/lib/garage-references";

type Params = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, { params }: Params) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!await garageMemberApproved(context))
    return NextResponse.json({ error: "ADMIN debe aprobar tu membresía de Garage antes de editar." }, { status: 403 });
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Anuncio inválido." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const expectedUpdatedAt = body && typeof body === "object" && "expectedUpdatedAt" in body
    ? (body as { expectedUpdatedAt?: unknown }).expectedUpdatedAt : null;
  if (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)))
    return NextResponse.json({ error: "Falta la versión actual del anuncio." }, { status: 400 });
  const valid = validateGarageDraft(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const referenceError = await validateGarageReferences(context.user.id, valid.draft.category_slug, valid.draft.images);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });
  const { data, error } = await context.client.from("garage_listings")
    .update({ ...valid.draft, status: "pending" }).eq("id", id).eq("owner_id", context.user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id,status").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo actualizar el anuncio." }, { status: 400 });
  if (!data) return NextResponse.json({ error: "El anuncio cambió o ya no está disponible. Actualizá Mis publicaciones." }, { status: 409 });
  return NextResponse.json({ listing: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!await garageMemberApproved(context))
    return NextResponse.json({ error: "Tu membresía de Garage no está aprobada." }, { status: 403 });
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Anuncio inválido." }, { status: 400 });
  let body: { expectedUpdatedAt?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (typeof body?.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
    return NextResponse.json({ error: "Falta la versión actual del anuncio." }, { status: 400 });
  const { data, error } = await context.client.from("garage_listings")
    .update({ status: "sold" }).eq("id", id).eq("owner_id", context.user.id).eq("status", "approved")
    .eq("updated_at", body.expectedUpdatedAt)
    .select("id,status").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Solo un anuncio aprobado puede marcarse vendido." }, { status: 409 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Anuncio inválido." }, { status: 400 });
  let body: { expectedUpdatedAt?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (typeof body?.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
    return NextResponse.json({ error: "Falta la versión actual del anuncio." }, { status: 400 });
  const { data, error } = await context.client.from("garage_listings")
    .delete().eq("id", id).eq("owner_id", context.user.id).eq("updated_at", body.expectedUpdatedAt)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo eliminar el anuncio." }, { status: 400 });
  if (!data) return NextResponse.json({ error: "El anuncio cambió o ya no está disponible. Actualizá Mis publicaciones." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
