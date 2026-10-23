import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiSiteContent, toApiSiteContent } from "@/lib/motoclub-api";
import { normalizeContent } from "@/lib/site-data";
import { getSupabaseAdmin, validateAdminCredentials } from "@/lib/supabase-admin";
import { readSiteContentState, writeSiteContentChanges, writeSiteContentState } from "@/lib/site-content-store";
import { prepareAdminSectionChanges } from "@/lib/admin-section-save";
import { isSiteContentVersionCurrent } from "@/lib/site-content-version";
import type { SiteSettings } from "@/lib/site-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUniqueIds(items: Record<string, unknown>[]) {
  const ids = items.map((item) => item.id);
  return ids.every((id) => typeof id === "string" && id.trim().length > 0) &&
    new Set(ids).size === ids.length;
}

function isValidAdminContent(value: unknown) {
  if (!isRecord(value) || typeof value.quienes !== "string") {
    return false;
  }

  const { navItems, fotos, events, novedades } = value;
  if (![navItems, fotos, events, novedades].every(Array.isArray)) {
    return false;
  }

  const nav = navItems as unknown[];
  const photos = fotos as unknown[];
  const eventItems = events as unknown[];
  const newsItems = novedades as unknown[];
  if (![...nav, ...photos, ...eventItems, ...newsItems].every(isRecord)) {
    return false;
  }

  return hasUniqueIds(nav as Record<string, unknown>[]) &&
    hasUniqueIds(eventItems as Record<string, unknown>[]) &&
    hasUniqueIds(newsItems as Record<string, unknown>[]) &&
    nav.every((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.label === "string" && Boolean(record.label.trim()) &&
        typeof record.href === "string" && Boolean(record.href.trim()) &&
        (record.visible === undefined || typeof record.visible === "boolean");
    }) &&
    photos.every((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.url === "string" && Boolean(record.url.trim()) &&
        (record.published === undefined || typeof record.published === "boolean");
    }) &&
    eventItems.every((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.name === "string" && Boolean(record.name.trim()) &&
        (record.published === undefined || typeof record.published === "boolean");
    }) &&
    newsItems.every((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.title === "string" &&
        (record.published === undefined || typeof record.published === "boolean");
    });
}

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

  return NextResponse.json({
    success: true,
    data: toApiSiteContent(result.state),
    version: result.state.updatedAt ?? null,
  });
}

export async function PUT(request: Request) {
  let payload: {
    username?: string;
    password?: string;
    content?: unknown;
    section?: unknown;
    sectionData?: unknown;
    expectedUpdatedAt?: string | null;
    updatedAt?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: string;
    aboutText?: string;
    contactText?: string;
    featuredEventId?: string;
    settings?: SiteSettings;
  };
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid JSON object");
    }
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (payload.section !== undefined) {
    if (payload.content !== undefined) {
      return NextResponse.json({ error: "Guardá una sección por solicitud." }, { status: 400 });
    }
    if (!getSupabaseAdmin()) {
      return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
    }
    if (!validateAdminCredentials(payload.username, payload.password)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "expectedUpdatedAt") ||
      (payload.expectedUpdatedAt !== null &&
        (typeof payload.expectedUpdatedAt !== "string" || !payload.expectedUpdatedAt))) {
      return NextResponse.json({ error: "Falta la versión del contenido. Recargá ADMIN antes de guardar." }, { status: 428 });
    }

    const current = await readSiteContentState();
    if (!current.ok) {
      return NextResponse.json({ error: current.error, detail: current.detail }, { status: current.status });
    }
    if (!isSiteContentVersionCurrent(payload.expectedUpdatedAt, current.state.updatedAt)) {
      return NextResponse.json({ error: "El contenido cambió en otra pestaña. No se guardó; tus ediciones siguen en el formulario. Copialas antes de recargar." }, { status: 409 });
    }

    const prepared = prepareAdminSectionChanges(payload.section, payload.sectionData, current.state);
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: 400 });
    }
    const saved = await writeSiteContentChanges(prepared.changes, current.state.updatedAt);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error, detail: saved.detail }, { status: saved.status });
    }
    return NextResponse.json({
      ok: true,
      content: saved.state.content,
      settings: saved.state.settings,
      featuredEventId: saved.state.settings.featuredEventId || "",
      updatedAt: saved.state.updatedAt ?? null,
    });
  }

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

    if (
      !Object.prototype.hasOwnProperty.call(payload, "expectedUpdatedAt") ||
      (payload.expectedUpdatedAt !== null &&
        (typeof payload.expectedUpdatedAt !== "string" || !payload.expectedUpdatedAt))
    ) {
      return NextResponse.json(
        { error: "Falta la versión del contenido. Recargá ADMIN antes de guardar." },
        { status: 428 }
      );
    }

    const current = await readSiteContentState();

    if (!current.ok) {
      return NextResponse.json(
        { error: current.error, detail: current.detail },
        { status: current.status }
      );
    }

    if (!isSiteContentVersionCurrent(payload.expectedUpdatedAt, current.state.updatedAt)) {
      return NextResponse.json(
        { error: "El contenido cambió en otra pestaña. No se guardó; tus ediciones siguen en el formulario. Copialas antes de recargar." },
        { status: 409 }
      );
    }

    if (!isValidAdminContent(payload.content)) {
      return NextResponse.json(
        { error: "El contenido tiene campos incompletos o inválidos. Revisá los formularios." },
        { status: 400 }
      );
    }

    const nextContent = normalizeContent((payload.content ?? null) as Parameters<typeof normalizeContent>[0]);
    if (payload.settings !== undefined && (
      !isRecord(payload.settings) ||
      Object.values(payload.settings).some((value) =>
        typeof value !== "string" &&
        !(Array.isArray(value) && value.every((item) =>
          isRecord(item) && typeof item.label === "string" && typeof item.value === "string"
        ))
      )
    )) {
      return NextResponse.json({ error: "La configuracion del sitio no es valida." }, { status: 400 });
    }
    const settingsImages = [
      payload.settings?.logoUrl, payload.settings?.aboutImageUrl, payload.settings?.heroImage,
      payload.settings?.lodgingImageUrl,
    ];
    const settingsLinks = [
      payload.settings?.heroPrimaryHref, payload.settings?.heroSecondaryHref, payload.settings?.lodgingLinkUrl,
    ];
    if (settingsImages.some((value) => value && !/^(https?:\/\/|\/(?!\/)|data:image\/jpeg;base64,)/i.test(value)) ||
      settingsLinks.some((value) => value && !/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(value))) {
      return NextResponse.json({ error: "Hay un enlace o imagen con una URL no permitida." }, { status: 400 });
    }
    if (payload.featuredEventId !== undefined && typeof payload.featuredEventId !== "string") {
      return NextResponse.json({ error: "El evento destacado no es válido." }, { status: 400 });
    }
    const requestedFeaturedId = payload.featuredEventId?.trim();
    if (requestedFeaturedId && !nextContent.events.some(
      (event) => event.id === requestedFeaturedId && event.published !== false
    )) {
      return NextResponse.json(
        { error: "El evento destacado debe existir y estar publicado." },
        { status: 400 }
      );
    }
    const firstPublishedId = nextContent.events.find((event) => event.published !== false)?.id || "";
    const savedFeaturedId = nextContent.events.find(
      (event) => event.id === current.state.settings.featuredEventId && event.published !== false
    )?.id;
    const featuredId = payload.featuredEventId !== undefined
      ? requestedFeaturedId || firstPublishedId
      : savedFeaturedId || firstPublishedId;
    const orderedEvents = featuredId
      ? [
          ...nextContent.events.filter((event) => event.id === featuredId),
          ...nextContent.events.filter((event) => event.id !== featuredId),
        ]
      : nextContent.events;
    const writeResult = await writeSiteContentState({
      content: { ...nextContent, events: orderedEvents },
      settings: { ...current.state.settings, ...payload.settings, featuredEventId: featuredId },
      updatedAt: current.state.updatedAt,
    });

    if (!writeResult.ok) {
      return NextResponse.json(
        { error: writeResult.error, detail: writeResult.detail },
        { status: writeResult.status }
      );
    }

    return NextResponse.json({
      ok: true,
      content: writeResult.state.content,
      featuredEventId: featuredId,
      settings: writeResult.state.settings,
      updatedAt: writeResult.state.updatedAt ?? null,
    });
  }

  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const apiExpectedUpdatedAt = Object.prototype.hasOwnProperty.call(payload, "expectedUpdatedAt")
    ? payload.expectedUpdatedAt
    : payload.updatedAt;
  if (
    apiExpectedUpdatedAt === undefined ||
    (apiExpectedUpdatedAt !== null &&
      (typeof apiExpectedUpdatedAt !== "string" || !apiExpectedUpdatedAt))
  ) {
    return NextResponse.json(
      { success: false, error: "Falta la versión del contenido. Consultá GET /api/site-content antes de guardar." },
      { status: 428 }
    );
  }

  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  if (!isSiteContentVersionCurrent(apiExpectedUpdatedAt, current.state.updatedAt)) {
    return NextResponse.json(
      { success: false, error: "El contenido cambió desde la última lectura. No se sobrescribieron los cambios." },
      { status: 409 }
    );
  }

  if (
    payload.featuredEventId !== undefined &&
    (typeof payload.featuredEventId !== "string" ||
      (Boolean(payload.featuredEventId.trim()) &&
        !current.state.content.events.some(
          (event) => event.id === payload.featuredEventId?.trim() && event.published !== false
        )))
  ) {
    return NextResponse.json(
      { success: false, error: "El evento destacado debe existir y estar publicado." },
      { status: 400 }
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
