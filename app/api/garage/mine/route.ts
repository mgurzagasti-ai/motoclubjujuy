import { NextResponse } from "next/server";
import { garageMemberApproved, memberContext } from "@/lib/garage-auth";
import { validateGarageDraft } from "@/lib/garage";
import { validateGarageReferences } from "@/lib/garage-references";

export async function GET(request: Request) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión para ver tus publicaciones." }, { status: 401 });
  const { data, error } = await context.client.from("garage_listings")
    .select("id,owner_id,title,description,category_slug,price,whatsapp,images,status,created_at,updated_at,submitted_at")
    .eq("owner_id", context.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "No se pudieron cargar tus publicaciones." }, { status: 500 });
  return NextResponse.json({ listings: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión para publicar." }, { status: 401 });
  if (!await garageMemberApproved(context))
    return NextResponse.json({ error: "ADMIN debe aprobar tu membresía de Garage antes de publicar." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const valid = validateGarageDraft(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const referenceError = await validateGarageReferences(context.user.id, valid.draft.category_slug, valid.draft.images);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });
  const { data, error } = await context.client.from("garage_listings")
    .insert({ ...valid.draft, owner_id: context.user.id, status: "pending" })
    .select("id,status").single();
  if (error) return NextResponse.json({ error: error.message.includes("garage_active_limit")
    ? "Tenés el máximo de 25 anuncios activos." : error.message.includes("garage_limit")
      ? "Alcanzaste el límite de publicaciones por hora." : "No se pudo enviar el anuncio." }, { status: 400 });
  return NextResponse.json({ listing: data }, { status: 201 });
}
