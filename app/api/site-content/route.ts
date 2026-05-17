import { NextResponse } from "next/server";
import { normalizeContent } from "@/lib/site-data";
import { getSupabaseAdmin, validateAdminCredentials } from "@/lib/supabase-admin";

export async function PUT(request: Request) {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as {
    username?: string;
    password?: string;
    content?: unknown;
  };

  if (!validateAdminCredentials(payload.username, payload.password)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const nextContent = normalizeContent((payload.content ?? null) as Parameters<typeof normalizeContent>[0]);

  const { error } = await admin.from("site_content").upsert(
    {
      slug: "main",
      quienes: nextContent.quienes,
      events: nextContent.events,
      novedades: nextContent.novedades,
    },
    { onConflict: "slug" }
  );

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el contenido en Supabase.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, content: nextContent });
}
