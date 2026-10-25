import { NextResponse } from "next/server";
import { garageAdminContext } from "@/lib/garage-auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pageSize = 25;

export async function GET(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const requestedPage = Number(new URL(request.url).searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 1000 ? requestedPage : 1;
  const { data, count, error } = await admin.from("garage_members")
    .select("user_id,status,requested_at,reviewed_at", { count: "exact" })
    .order("requested_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "No se pudieron cargar las solicitudes." }, { status: 500 });
  const members = await Promise.all((data || []).map(async (entry) => {
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(entry.user_id);
    return { ...entry, email: authError ? null : authData?.user?.email || null,
      emailConfirmed: Boolean(authData?.user?.email_confirmed_at) };
  }));
  return NextResponse.json({ members, page, total: count || 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const admin = garageAdminContext(request);
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: { userId?: string; status?: string; expectedStatus?: string; expectedReviewedAt?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body?.userId || !uuid.test(body.userId) || !["approved", "rejected"].includes(body.status || ""))
    return NextResponse.json({ error: "Miembro o decisión inválidos." }, { status: 400 });
  if (!["pending", "approved", "rejected"].includes(body.expectedStatus || "") ||
    !(body.expectedReviewedAt === null || (typeof body.expectedReviewedAt === "string" &&
      Number.isFinite(Date.parse(body.expectedReviewedAt)))))
    return NextResponse.json({ error: "Falta la versión actual de la solicitud." }, { status: 400 });
  if (body.status === "approved") {
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(body.userId);
    if (authError || !authData?.user?.email || authData.user.is_anonymous || !authData.user.email_confirmed_at)
      return NextResponse.json({ error: "La cuenta debe tener un correo confirmado antes de autorizarla." }, { status: 400 });
  }
  let change = admin.from("garage_members")
    .update({ status: body.status, reviewed_at: new Date().toISOString() })
    .eq("user_id", body.userId).eq("status", body.expectedStatus);
  change = body.expectedReviewedAt === null
    ? change.is("reviewed_at", null) : change.eq("reviewed_at", body.expectedReviewedAt!);
  const { data, error } = await change.select("user_id,status,reviewed_at").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo actualizar la membresía." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "La solicitud cambió o ya no existe. Actualizá Garage." }, { status: 409 });
  return NextResponse.json({ membership: data });
}
