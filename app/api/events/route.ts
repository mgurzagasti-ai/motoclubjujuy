import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiEvent, toApiEvent, type ApiEvent } from "@/lib/motoclub-api";
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
    data: result.state.content.events.map((event) => toApiEvent(event)),
  });
}

export async function POST(request: Request) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const payload = (await request.json()) as Partial<ApiEvent>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const nextEvent = mergeApiEvent(null, payload);
  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      events: [...current.state.content.events, nextEvent],
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiEvent(nextEvent) }, { status: 201 });
}
