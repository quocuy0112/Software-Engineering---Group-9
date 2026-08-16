import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  OpenApplicationDocumentError,
  OpenApplicationDocumentService,
} from "@/backend/applications/services/open-application-document";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function safeFileName(value: string | null, kind: string) {
  const fallback = kind === "cv" ? "candidate-cv.pdf" : "cover-letter.pdf";
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
      jobId,
      applicationId,
      kind,
      preview: true,
    });
    if (result.document.text !== null) {
      return new NextResponse(result.document.text, {
        headers: {
          ...noStore,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${safeFileName(null, kind)}"`,
        },
      });
    }
    if (!result.stream) throw new OpenApplicationDocumentError("UNAVAILABLE");
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
        "Content-Disposition": `inline; filename="${safeFileName(result.document.fileName, kind)}"`,
      },
    });
  } catch (error) {
    const code =
      error instanceof OpenApplicationDocumentError
        ? error.code
        : "UNAVAILABLE";
    return NextResponse.json(
      {
        code,
        message:
          code === "PREVIEW_UNAVAILABLE"
            ? "Preview is unavailable; download the original file."
            : "The document is not available.",
      },
      { status: code === "PREVIEW_UNAVAILABLE" ? 409 : 404, headers: noStore },
    );
  }
}
