import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiSiteContent, toApiSiteContent } from "@/lib/motoclub-api";
import { normalizeContent } from "@/lib/site-data";
import { getSupabaseAdmin, validateAdminCredentials } from "@/lib/supabase-admin";
import { readSiteContentState, writeSiteContentState } from "@/lib/site-content-store";

export async function GET(request: Request) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const result = await readSiteContentState();

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, detail: result.detail },
      { status: result.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiSiteContent(result.state) });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as {
    username?: string;
    password?: string;
    content?: unknown;
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: string;
    aboutText?: string;
    contactText?: string;
    featuredEventId?: string;
  };

  if (payload.content !== undefined) {
    const admin = getSupabaseAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 }
      );
    }

    if (!validateAdminCredentials(payload.username, payload.password)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const current = await readSiteContentState();

    if (!current.ok) {
      return NextResponse.json(
        { error: current.error, detail: current.detail },
        { status: current.status }
      );
    }

    const nextContent = normalizeContent((payload.content ?? null) as Parameters<typeof normalizeContent>[0]);
    const writeResult = await writeSiteContentState({
      content: nextContent,
      settings: current.state.settings,
      updatedAt: current.state.updatedAt,
    });

    if (!writeResult.ok) {
      return NextResponse.json(
        { error: writeResult.error, detail: writeResult.detail },
        { status: writeResult.status }
      );
    }

    return NextResponse.json({ ok: true, content: writeResult.state.content });
  }

  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const nextState = mergeApiSiteContent(current.state, payload);
  const writeResult = await writeSiteContentState(nextState);

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiSiteContent(writeResult.state) });
}
