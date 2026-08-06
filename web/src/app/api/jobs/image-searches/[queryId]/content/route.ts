import { enforceImageSearchRequestBoundary } from "@/backend/security/image-search-request-boundary";
import {
  imageSearchErrorResponse,
  noStoreHeaders,
} from "@/backend/services/image-search/image-search-errors";
import { createImageSearchRouteResources } from "@/backend/services/image-search/route-resources";

type Context = { params: Promise<{ queryId: string }> };

async function* requestBody(request: Request) {
  if (!request.body) return;
  const reader = request.body.getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const resources = createImageSearchRouteResources();
    const boundary = await enforceImageSearchRequestBoundary(request, {
      mutation: true,
      requireIdempotency: true,
      capabilityRequiredForVisitor: true,
      rateHmacKey: resources.rateHmacKey,
    });
    const rawLength = request.headers.get("content-length");
    const contentLength =
      rawLength && /^\d{1,10}$/u.test(rawLength) ? Number(rawLength) : null;
    const { queryId } = await context.params;
    await resources.receive.execute({
      queryId,
      actor: boundary.actor,
      visitorCapability: boundary.visitorCapability,
      contentType: request.headers.get("content-type"),
      contentLength,
      source: requestBody(request),
    });
    return new Response(null, { status: 202, headers: noStoreHeaders });
  } catch (error) {
    return imageSearchErrorResponse(error);
  }
}
