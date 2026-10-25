import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, validateAdminCredentials } from "@/lib/supabase-admin";
import { parseAdminPhotoAuthorization } from "@/lib/photo-security";

export async function memberContext(request: Request) {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!match || !url || !anon) return null;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  return error || !data.user || !data.user.email || data.user.is_anonymous ? null : { user: data.user, client };
}

export async function garageMemberApproved(context: NonNullable<Awaited<ReturnType<typeof memberContext>>>) {
  const { data, error } = await context.client.from("garage_members")
    .select("status").eq("user_id", context.user.id).maybeSingle();
  return !error && data?.status === "approved";
}

export function garageAdminContext(request: Request) {
  const credentials = parseAdminPhotoAuthorization(request.headers.get("authorization"));
  if (!credentials || !validateAdminCredentials(credentials.username, credentials.password)) return null;
  return getSupabaseAdmin();
}
