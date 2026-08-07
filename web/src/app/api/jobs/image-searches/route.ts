import { enforceImageSearchRequestBoundary } from "@/backend/security/image-search-request-boundary";
import {
  imageSearchErrorResponse,
  noStoreHeaders,
} from "@/backend/services/image-search/image-search-errors";
import { createImageSearchRouteResources } from "@/backend/services/image-search/route-resources";

export async function POST(request: Request) {
  try {
    const resources = createImageSearchRouteResources();
    const boundary = await enforceImageSearchRequestBoundary(request, {
      mutation: true,
      requireIdempotency: true,
      rateHmacKey: resources.rateHmacKey,
    });
    const body = await request.json().catch(() => null);
    const result = await resources.create.executeForHttp({
      actor: boundary.actor,
      sourceIpDigest: resources.sourceIpDigest(request),
      idempotencyKey: boundary.idempotencyKey!,
      body,
    });
    return Response.json(result.outcome, {
      status: result.replayed ? 200 : 201,
      headers: {
        ...noStoreHeaders,
        ...(boundary.newRateCookie
          ? { "set-cookie": boundary.newRateCookie }
          : {}),
      },
    });
  } catch (error) {
    return imageSearchErrorResponse(error);
  }
}
