import { NextResponse } from "next/server";
import { garageAdminContext } from "@/lib/garage-auth";

function categoryInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const slug = typeof value.slug === "string" ? value.slug.trim().toLowerCase() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  return /^[a-z0-9-]{2,40}$/.test(slug) && label.length >= 2 && label.length <= 60
    ? { slug, label, active: value.active !== false } : null;
}

export async function GET(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await admin.from("garage_categories").select("slug,label,active").order("label");
  if (error) return NextResponse.json({ error: "No se pudieron cargar las categorías." }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function PUT(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const input = categoryInput(body);
  if (!input) return NextResponse.json({ error: "Slug o nombre de categoría inválidos." }, { status: 400 });
  const { data, error } = await admin.from("garage_categories").upsert(input, { onConflict: "slug" })
    .select("slug,label,active").single();
  if (error) return NextResponse.json({ error: "No se pudo guardar la categoría." }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: { slug?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body?.slug || !/^[a-z0-9-]{2,40}$/.test(body.slug))
    return NextResponse.json({ error: "Categoría inválida." }, { status: 400 });
  const { error } = await admin.from("garage_categories").delete().eq("slug", body.slug);
  if (error) return NextResponse.json({ error: "La categoría tiene anuncios o no pudo eliminarse. Podés ocultarla." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
