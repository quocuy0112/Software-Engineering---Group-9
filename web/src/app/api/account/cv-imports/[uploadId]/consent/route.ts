import { createCvConsentHandlers } from "./handler";

const handlers = createCvConsentHandlers();

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
): Promise<Response> {
  return handlers.POST(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
): Promise<Response> {
  return handlers.DELETE(request, context);
}
