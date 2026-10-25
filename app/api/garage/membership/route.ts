import { NextResponse } from "next/server";
import { memberContext } from "@/lib/garage-auth";

export async function GET(request: Request) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión con correo para consultar tu solicitud." }, { status: 401 });
  const { data, error } = await context.client.from("garage_members")
    .select("status,requested_at,reviewed_at").eq("user_id", context.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo consultar tu solicitud." }, { status: 500 });
  return NextResponse.json({ membership: data || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await memberContext(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión con correo para solicitar acceso." }, { status: 401 });
  const { data, error } = await context.client.from("garage_members")
    .insert({ user_id: context.user.id }).select("status,requested_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505"
    ? "Ya existe una solicitud para esta cuenta." : "No se pudo solicitar acceso a Garage." },
  { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ membership: data }, { status: 201 });
}
