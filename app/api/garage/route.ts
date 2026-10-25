import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const category = params.get("category")?.trim() || "";
  const search = params.get("q")?.trim().slice(0, 80) || "";
  let query = supabase.from("garage_listings")
    .select("id,title,description,category_slug,price,whatsapp,images,created_at")
    .eq("status", "approved").order("created_at", { ascending: false }).limit(60);
  if (category && /^[a-z0-9-]{2,40}$/.test(category)) query = query.eq("category_slug", category);
  if (search) {
    const safe = search.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "No se pudo cargar Garage." }, { status: 500 });
  return NextResponse.json({ listings: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
