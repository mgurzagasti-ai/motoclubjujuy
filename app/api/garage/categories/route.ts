import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data, error } = await supabase.from("garage_categories")
    .select("slug,label,active").eq("active", true).order("label");
  if (error) return NextResponse.json({ error: "No se pudieron cargar las categorías." }, { status: 500 });
  return NextResponse.json({ categories: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
