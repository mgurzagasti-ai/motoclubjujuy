import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeContent, type MotoclubContent } from "@/lib/site-data";
import { nextSiteContentUpdatedAt } from "@/lib/site-content-version";
import type { SiteSettings } from "@/lib/site-settings";

export type { SiteSettings } from "@/lib/site-settings";

type SiteContentRow = {
  slug: string;
  nav_items: unknown;
  quienes: string;
  fotos: unknown;
  events: unknown;
  novedades: unknown;
  settings: SiteSettings | null;
  updated_at: string | null;
};

export type SiteContentState = {
  content: MotoclubContent;
  settings: SiteSettings;
  updatedAt?: string;
};

export type SiteContentChanges = Partial<{
  nav_items: MotoclubContent["navItems"];
  quienes: string;
  fotos: MotoclubContent["fotos"];
  events: MotoclubContent["events"];
  novedades: MotoclubContent["novedades"];
  settings: SiteSettings;
}>;

const baseSelect = "slug, nav_items, quienes, fotos, events, novedades, updated_at";
const extendedSelect = `${baseSelect}, settings`;

function isMissingSettingsColumnError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() || "";

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("site_content.settings") ||
    message.includes("'settings' column") ||
    message.includes("column settings does not exist")
  );
}

function isNoRowsError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  return error.code === "PGRST116";
}

function toSiteContentState(row: SiteContentRow | null): SiteContentState {
  if (!row) {
    return { content: normalizeContent(null), settings: {} };
  }

  return {
    content: normalizeContent({
      navItems: row.nav_items,
      quienes: row.quienes,
      fotos: row.fotos,
      events: row.events,
      novedades: row.novedades,
    } as Partial<MotoclubContent>),
    settings: row.settings || {},
    updatedAt: row.updated_at || undefined,
  };
}

export async function readSiteContentState(): Promise<
  | { ok: true; state: SiteContentState }
  | { ok: false; status: number; error: string; detail?: string }
> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return {
      ok: false,
      status: 500,
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    };
  }

  const query = admin.from("site_content").select(extendedSelect).eq("slug", "main").maybeSingle();
  let { data, error } = await query;

  if (isMissingSettingsColumnError(error)) {
    const fallback = await admin.from("site_content").select(baseSelect).eq("slug", "main").maybeSingle();
    data = (fallback.data
      ? {
          ...fallback.data,
          settings: null,
        }
      : null) as SiteContentRow | null;
    error = fallback.error;
  }

  if (isNoRowsError(error)) {
    error = null;
    data = null;
  }

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "No se pudo consultar el contenido en Supabase.",
      detail: error.message,
    };
  }

  return { ok: true, state: toSiteContentState(data as SiteContentRow | null) };
}

export async function writeSiteContentState(state: SiteContentState) {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return {
      ok: false as const,
      status: 500,
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    };
  }

  const baseValues = {
    nav_items: state.content.navItems,
    quienes: state.content.quienes,
    fotos: state.content.fotos,
    events: state.content.events,
    novedades: state.content.novedades,
    updated_at: nextSiteContentUpdatedAt(state.updatedAt, Date.now()),
  };
  const save = (includeSettings: boolean) => {
    const values = includeSettings ? { ...baseValues, settings: state.settings } : baseValues;
    if (state.updatedAt) {
      return admin
        .from("site_content")
        .update(values)
        .eq("slug", "main")
        .eq("updated_at", state.updatedAt)
        .select(includeSettings ? extendedSelect : baseSelect)
        .maybeSingle();
    }

    return admin
      .from("site_content")
      .insert({ slug: "main", ...values })
      .select(includeSettings ? extendedSelect : baseSelect)
      .maybeSingle();
  };

  let hasSettings = true;
  let { data, error } = await save(hasSettings);
  if (isMissingSettingsColumnError(error)) {
    if (Object.keys(state.settings).some((key) => key !== "featuredEventId")) {
      return {
        ok: false as const,
        status: 500,
        error: "La tabla site_content no tiene la columna settings. No se guardaron los ajustes del sitio.",
      };
    }
    hasSettings = false;
    const fallback = await save(hasSettings);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false as const,
        status: 409,
        error: "El contenido cambió mientras se guardaba. No se sobrescribieron los cambios.",
      };
    }

    return {
      ok: false as const,
      status: 500,
      error: "No se pudo guardar el contenido en Supabase.",
      detail: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      status: 409,
      error: "El contenido cambió mientras se guardaba. No se sobrescribieron los cambios.",
    };
  }

  const row = data as unknown as SiteContentRow;
  return {
    ok: true as const,
    state: toSiteContentState(hasSettings ? row : { ...row, settings: null }),
  };
}

export async function writeSiteContentChanges(changes: SiteContentChanges, updatedAt?: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false as const, status: 500, error: "Supabase no está configurado." };
  }
  if (!updatedAt) {
    return { ok: false as const, status: 409, error: "No se pudo comprobar la versión del contenido. Recargá ADMIN." };
  }

  const { data, error } = await admin.from("site_content")
    .update({ ...changes, updated_at: nextSiteContentUpdatedAt(updatedAt, Date.now()) })
    .eq("slug", "main")
    .eq("updated_at", updatedAt)
    .select(extendedSelect)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: "No se pudo guardar la sección en Supabase.",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      status: 409,
      error: "El contenido cambió mientras se guardaba. Recargá ADMIN; no se sobrescribieron otros cambios.",
    };
  }
  return { ok: true as const, state: toSiteContentState(data as SiteContentRow) };
}
