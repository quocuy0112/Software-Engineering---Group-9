import { enforceImageSearchRequestBoundary } from "@/backend/security/image-search-request-boundary";
import {
  imageSearchErrorResponse,
  noStoreHeaders,
} from "@/backend/services/image-search/image-search-errors";
import { createImageSearchRouteResources } from "@/backend/services/image-search/route-resources";

type Context = { params: Promise<{ queryId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const resources = createImageSearchRouteResources();
    const boundary = await enforceImageSearchRequestBoundary(request, {
      mutation: false,
      capabilityRequiredForVisitor: true,
      rateHmacKey: resources.rateHmacKey,
    });
    const { queryId } = await context.params;
    const result = await resources.status.execute({
      queryId,
      actor: boundary.actor,
      visitorCapability: boundary.visitorCapability,
    });
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return imageSearchErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const resources = createImageSearchRouteResources();
    const boundary = await enforceImageSearchRequestBoundary(request, {
      mutation: true,
      requireIdempotency: true,
      capabilityRequiredForVisitor: true,
      rateHmacKey: resources.rateHmacKey,
    });
    const { queryId } = await context.params;
    await resources.cancel.execute({
      queryId,
      actor: boundary.actor,
      visitorCapability: boundary.visitorCapability,
    });
    return new Response(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    return imageSearchErrorResponse(error);
  }
}
