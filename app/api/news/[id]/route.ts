import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiNewsItem, toApiNewsItem, type ApiNewsItem } from "@/lib/motoclub-api";
import { readSiteContentState, writeSiteContentState } from "@/lib/site-content-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const { id } = await context.params;
  const result = await readSiteContentState();

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, detail: result.detail },
      { status: result.status }
    );
  }

  const item = result.state.content.novedades.find((news) => news.id === id);

  if (!item) {
    return NextResponse.json({ success: false, error: "Novedad no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: toApiNewsItem(item) });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const { id } = await context.params;
  const payload = (await request.json()) as Partial<ApiNewsItem>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const index = current.state.content.novedades.findIndex((news) => news.id === id);

  if (index < 0) {
    return NextResponse.json({ success: false, error: "Novedad no encontrada." }, { status: 404 });
  }

  const updatedItem = mergeApiNewsItem(current.state.content.novedades[index], payload);
  const nextItems = [...current.state.content.novedades];
  nextItems[index] = updatedItem;

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      novedades: nextItems,
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiNewsItem(updatedItem) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const { id } = await context.params;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const nextItems = current.state.content.novedades.filter((news) => news.id !== id);

  if (nextItems.length === current.state.content.novedades.length) {
    return NextResponse.json({ success: false, error: "Novedad no encontrada." }, { status: 404 });
  }

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      novedades: nextItems,
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: { id } });
}
