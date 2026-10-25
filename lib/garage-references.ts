import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function validateGarageReferences(ownerId: string, category: string, images: string[]) {
  const admin = getSupabaseAdmin();
  if (!admin) return "Supabase no está configurado.";
  const { data: categoryRow, error: categoryError } = await admin.from("garage_categories")
    .select("slug").eq("slug", category).eq("active", true).maybeSingle();
  if (categoryError || !categoryRow) return "Elegí una categoría activa.";
  const { data: uploads, error: uploadError } = await admin.from("garage_uploads")
    .select("url").eq("owner_id", ownerId).neq("provider", "pending").in("url", images);
  if (uploadError || uploads?.length !== images.length) return "Todas las fotos deben haberse subido desde tu cuenta.";
  return null;
}
