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
  context: { params: Promise<unknown> },
) {
  const current = await requireSession(request.headers);
  if (!current) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Authentication required." },
      { status: 401, headers: noStore },
    );
  }
  const rawParams = await context.params;
  const params =
    rawParams && typeof rawParams === "object"
      ? (rawParams as Record<string, unknown>)
      : {};
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const applicationId =
    typeof params.applicationId === "string" ? params.applicationId : "";
  const rawKind = typeof params.kind === "string" ? params.kind : "";
  const kind = rawKind === "cv" || rawKind === "cover-letter" ? rawKind : null;
  if (!kind) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "The document kind is invalid." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const result = await new OpenApplicationDocumentService().execute({
      userId: current.userId,
      sessionId: current.sessionId,
      jobId,
      applicationId,
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
