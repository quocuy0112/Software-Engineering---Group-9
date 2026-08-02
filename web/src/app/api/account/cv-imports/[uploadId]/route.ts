import { createCvImportResourceHandlers } from "./handler";

const handlers = createCvImportResourceHandlers();

export async function GET(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
): Promise<Response> {
  return handlers.GET(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
): Promise<Response> {
  return handlers.DELETE(request, context);
}
