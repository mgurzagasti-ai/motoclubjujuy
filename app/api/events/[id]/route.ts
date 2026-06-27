import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiEvent, toApiEvent, type ApiEvent } from "@/lib/motoclub-api";
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

  const event = result.state.content.events.find((item) => item.id === id);

  if (!event) {
    return NextResponse.json({ success: false, error: "Evento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: toApiEvent(event) });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const { id } = await context.params;
  const payload = (await request.json()) as Partial<ApiEvent>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const index = current.state.content.events.findIndex((item) => item.id === id);

  if (index < 0) {
    return NextResponse.json({ success: false, error: "Evento no encontrado." }, { status: 404 });
  }

  const updatedEvent = mergeApiEvent(current.state.content.events[index], payload);
  const nextEvents = [...current.state.content.events];
  nextEvents[index] = updatedEvent;

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      events: nextEvents,
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiEvent(updatedEvent) });
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

  const nextEvents = current.state.content.events.filter((item) => item.id !== id);

  if (nextEvents.length === current.state.content.events.length) {
    return NextResponse.json({ success: false, error: "Evento no encontrado." }, { status: 404 });
  }

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      events: nextEvents,
    },
    settings:
      current.state.settings.featuredEventId === id
        ? { ...current.state.settings, featuredEventId: nextEvents[0]?.id }
        : current.state.settings,
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: { id } });
}
