import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { OpenApplicationDocumentService } from "@/backend/applications/services/open-application-document";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function safeFileName(value: string | null, kind: string) {
  const fallback = kind === "cv" ? "candidate-cv" : "cover-letter";
  const fileName = (value ?? fallback)
    .replace(/[\\/\r\n]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 180);
  return fileName || fallback;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string; applicationId: string; kind: string }> },
) {
  const current = await requireSession(request.headers);
  if (!current) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Authentication required." },
      { status: 401, headers: noStore },
    );
  }
  const params = await context.params;
  const kind = params.kind === "cv" || params.kind === "cover-letter" ? params.kind : null;
  if (!kind) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "The document kind is invalid." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const result = await new OpenApplicationDocumentService().execute({
      userId: current.userId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      kind,
      preview: false,
    });
    if (result.document.text !== null) {
      return new NextResponse(result.document.text, {
        headers: {
          ...noStore,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeFileName(null, kind)}.txt"`,
        },
      });
    }
    if (!result.stream) throw new Error("DOCUMENT_UNAVAILABLE");
    const iterator = result.stream[Symbol.asyncIterator]();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      cancel() {
        void iterator.return?.();
      },
    });
    return new NextResponse(stream, {
      headers: {
        ...noStore,
        "Content-Type": result.document.mediaType ?? "application/octet-stream",
        "Content-Length": String(result.document.byteLength),
        "Content-Disposition": `attachment; filename="${safeFileName(result.document.fileName, kind)}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "The document is not available." },
      { status: 404, headers: noStore },
    );
  }
}
