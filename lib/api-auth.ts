import { NextResponse } from "next/server";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function isApiTokenValid(request: Request) {
  const expectedToken =
    process.env.SAAS_PANEL_API_TOKEN || process.env.API_BEARER_TOKEN || process.env.MOTOCLUB_API_TOKEN;

  if (!expectedToken) {
    return { ok: false as const, reason: "missing-config" as const };
  }

  const receivedToken = getBearerToken(request);

  if (!receivedToken || receivedToken !== expectedToken) {
    return { ok: false as const, reason: "unauthorized" as const };
  }

  return { ok: true as const };
}

export function createApiAuthError(reason: "missing-config" | "unauthorized") {
  if (reason === "missing-config") {
    return NextResponse.json(
      { success: false, error: "Falta configurar SAAS_PANEL_API_TOKEN en el servidor." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
}
