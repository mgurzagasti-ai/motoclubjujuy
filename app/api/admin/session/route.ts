import { NextResponse } from "next/server";
import { validateAdminCredentials } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    username?: string;
    password?: string;
  };

  if (!validateAdminCredentials(payload.username, payload.password)) {
    return NextResponse.json({ error: "Usuario o contrasena incorrectos." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
