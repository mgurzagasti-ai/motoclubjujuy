import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeContent, type MotoclubContent } from "@/lib/site-data";

export type SiteSettings = {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  contactText?: string;
  featuredEventId?: string;
};

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

const baseSelect = "slug, nav_items, quienes, fotos, events, novedades, updated_at";
const extendedSelect = `${baseSelect}, settings`;

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

  const query = admin.from("site_content").select(extendedSelect).eq("slug", "main").single();
  let { data, error } = await query;

  if (error?.message.includes("Could not find the 'settings' column")) {
    const fallback = await admin.from("site_content").select(baseSelect).eq("slug", "main").single();
    data = (fallback.data
      ? {
          ...fallback.data,
          settings: null,
        }
      : null) as SiteContentRow | null;
    error = fallback.error;
  }

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "No se pudo consultar el contenido en Supabase.",
      detail: error.message,
    };
  }

  const row = data as SiteContentRow | null;

  if (!row) {
    return {
      ok: true,
      state: {
        content: normalizeContent(null),
        settings: {},
      },
    };
  }

  return {
      ok: true,
      state: {
      content: normalizeContent(
        {
          navItems: row.nav_items,
          quienes: row.quienes,
          fotos: row.fotos,
          events: row.events,
          novedades: row.novedades,
        } as Partial<MotoclubContent>
      ),
      settings: row.settings || {},
      updatedAt: row.updated_at || undefined,
    },
  };
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

  let { error } = await admin.from("site_content").upsert(
    {
      slug: "main",
      nav_items: state.content.navItems,
      quienes: state.content.quienes,
      fotos: state.content.fotos,
      events: state.content.events,
      novedades: state.content.novedades,
      settings: state.settings,
    },
    { onConflict: "slug" }
  );

  if (error?.message.includes("Could not find the 'settings' column")) {
    const fallback = await admin.from("site_content").upsert(
      {
        slug: "main",
        nav_items: state.content.navItems,
        quienes: state.content.quienes,
        fotos: state.content.fotos,
        events: state.content.events,
        novedades: state.content.novedades,
      },
      { onConflict: "slug" }
    );

    error = fallback.error;
  }

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: "No se pudo guardar el contenido en Supabase.",
      detail: error.message,
    };
  }

  const latest = await readSiteContentState();

  if (!latest.ok) {
    return latest;
  }

  return { ok: true as const, state: latest.state };
}
