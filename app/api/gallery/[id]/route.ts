import { NextResponse } from "next/server";
import { createApiAuthError, isApiTokenValid } from "@/lib/api-auth";
import { mergeApiGalleryItem, toApiGalleryItem, type ApiGalleryItem } from "@/lib/motoclub-api";
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

  const index = result.state.content.fotos.findIndex((photo, itemIndex) => toApiGalleryItem(photo, itemIndex).id === id);

  if (index < 0) {
    return NextResponse.json({ success: false, error: "Imagen no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: toApiGalleryItem(result.state.content.fotos[index], index) });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = isApiTokenValid(request);

  if (!auth.ok) {
    return createApiAuthError(auth.reason);
  }

  const { id } = await context.params;
  const payload = (await request.json()) as Partial<ApiGalleryItem>;
  const current = await readSiteContentState();

  if (!current.ok) {
    return NextResponse.json(
      { success: false, error: current.error, detail: current.detail },
      { status: current.status }
    );
  }

  const index = current.state.content.fotos.findIndex((photo, itemIndex) => toApiGalleryItem(photo, itemIndex).id === id);

  if (index < 0) {
    return NextResponse.json({ success: false, error: "Imagen no encontrada." }, { status: 404 });
  }

  const updatedPhoto = mergeApiGalleryItem(current.state.content.fotos[index], payload);
  const nextPhotos = [...current.state.content.fotos];
  nextPhotos[index] = updatedPhoto;

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      fotos: nextPhotos,
    },
  });

  if (!writeResult.ok) {
    return NextResponse.json(
      { success: false, error: writeResult.error, detail: writeResult.detail },
      { status: writeResult.status }
    );
  }

  return NextResponse.json({ success: true, data: toApiGalleryItem(updatedPhoto, index) });
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

  const nextPhotos = current.state.content.fotos.filter(
    (photo, itemIndex) => toApiGalleryItem(photo, itemIndex).id !== id
  );

  if (nextPhotos.length === current.state.content.fotos.length) {
    return NextResponse.json({ success: false, error: "Imagen no encontrada." }, { status: 404 });
  }

  const writeResult = await writeSiteContentState({
    ...current.state,
    content: {
      ...current.state.content,
      fotos: nextPhotos,
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
