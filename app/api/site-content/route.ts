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
  const fullPayload = {
    slug: "main",
    nav_items: nextContent.navItems,
    quienes: nextContent.quienes,
    fotos: nextContent.fotos,
    events: nextContent.events,
    novedades: nextContent.novedades,
  };

  let { error } = await admin.from("site_content").upsert(fullPayload, { onConflict: "slug" });

  if (error?.message.includes("Could not find")) {
    const fallbackPayload: {
      slug: string;
      nav_items?: typeof nextContent.navItems;
      quienes: string;
      fotos?: typeof nextContent.fotos;
      events: typeof nextContent.events;
      novedades: typeof nextContent.novedades;
    } = {
      slug: "main",
      nav_items: nextContent.navItems,
      quienes: nextContent.quienes,
      fotos: nextContent.fotos,
      events: nextContent.events,
      novedades: nextContent.novedades,
    };

    if (error.message.includes("Could not find the 'fotos' column")) {
      delete fallbackPayload.fotos;
    }

    if (error.message.includes("Could not find the 'nav_items' column")) {
      delete fallbackPayload.nav_items;
    }

    const fallbackResult = await admin.from("site_content").upsert(fallbackPayload, {
      onConflict: "slug",
    });

    error = fallbackResult.error;
  }

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el contenido en Supabase.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, content: nextContent });
}
