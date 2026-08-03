import { createCvImportRetryPostHandler } from "./handler";

const post = createCvImportRetryPostHandler();

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
): Promise<Response> {
  return post(request, context);
}
