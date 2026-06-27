import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiNewsItem, toApiNewsItem, type ApiNewsItem } from "@/lib/motoclub-api";
import { readSiteContentState, writeSiteContentState } from "@/lib/site-content-store";

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
    data: result.state.content.novedades.map((item) => toApiNewsItem(item)),
  });
}

export async function POST(request: Request) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const payload = (await request.json()) as Partial<ApiNewsItem>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const nextItem = mergeApiNewsItem(null, payload);
  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      novedades: [...current.state.content.novedades, nextItem],
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiNewsItem(nextItem) }, { status: 201 });
}
