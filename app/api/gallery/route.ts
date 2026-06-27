import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiGalleryItem, toApiGalleryItem, type ApiGalleryItem } from "@/lib/motoclub-api";
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
    data: result.state.content.fotos.map((photo, index) => toApiGalleryItem(photo, index)),
  });
}

export async function POST(request: Request) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const payload = (await request.json()) as Partial<ApiGalleryItem>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const nextPhoto = mergeApiGalleryItem(null, payload);
  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      fotos: [...current.state.content.fotos, nextPhoto],
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiGalleryItem(nextPhoto, 0) }, { status: 201 });
}
