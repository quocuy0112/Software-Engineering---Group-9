import { enforceImageSearchRequestBoundary } from "@/backend/security/image-search-request-boundary";
import {
  imageSearchErrorResponse,
  noStoreHeaders,
} from "@/backend/services/image-search/image-search-errors";
import { createImageSearchRouteResources } from "@/backend/services/image-search/route-resources";

type Context = { params: Promise<{ queryId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const resources = createImageSearchRouteResources();
    const boundary = await enforceImageSearchRequestBoundary(request, {
      mutation: true,
      requireIdempotency: true,
      capabilityRequiredForVisitor: true,
      rateHmacKey: resources.rateHmacKey,
    });
    const { queryId } = await context.params;
    const result = await resources.consent.execute({
      queryId,
      actor: boundary.actor,
      visitorCapability: boundary.visitorCapability,
      idempotencyKey: boundary.idempotencyKey!,
      body: await request.json().catch(() => null),
    });
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return imageSearchErrorResponse(error);
  }
}
