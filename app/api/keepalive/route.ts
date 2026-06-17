import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const expectedToken = process.env.KEEPALIVE_TOKEN;

  if (expectedToken) {
    const requestToken = new URL(request.url).searchParams.get("token");

    if (requestToken !== expectedToken) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    return NextResponse.json(
      { ok: true, source: "app", detail: "Supabase no esta configurado en este entorno." },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const { data, error } = await admin
    .from("site_content")
    .select("slug, updated_at")
    .eq("slug", "main")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo consultar Supabase.", detail: error.message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      source: "supabase",
      slug: data.slug,
      updatedAt: data.updated_at,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
