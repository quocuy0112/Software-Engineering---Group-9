import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  DocumentExtractionError,
  IsolatedDocumentExtractor,
} from "@/backend/cv/extraction/document-extractor";
import {
  OpenApplicationDocumentError,
  OpenApplicationDocumentService,
} from "@/backend/applications/services/open-application-document";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

type DocumentKind = "cv" | "cover-letter";
type PreviewSegment = Readonly<{
  id: string;
  kind: "heading" | "paragraph" | "list-item";
  text: string;
}>;

function isDocumentKind(value: unknown): value is DocumentKind {
  return value === "cv" || value === "cover-letter";
}

function textSegments(text: string) {
  return text
    .split(/\r?\n+/u)
    .map((value, index) => ({
      id: `text-line-${index + 1}`,
      kind: "paragraph" as const,
      text: value.replace(/\s+/gu, " ").trim(),
    }))
    .filter((segment) => segment.text.length > 0);
}

function extractionKind(mediaType: string | null) {
  if (mediaType === "application/pdf") return "PDF" as const;
  if (
    mediaType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX" as const;
  return null;
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
  const kind = isDocumentKind(params.kind) ? params.kind : null;
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
      preview: false,
    });
    let segments: readonly PreviewSegment[];
    let pageCount: number | null = null;

    if (result.document.text !== null) {
      segments = textSegments(result.document.text);
      pageCount = 1;
    } else {
      const parserKind = extractionKind(result.document.mediaType);
      if (!parserKind || !result.stream) {
        return NextResponse.json(
          {
            code: "PREVIEW_UNAVAILABLE",
            message: "Parsed preview is unavailable for this document.",
          },
          { status: 409, headers: noStore },
        );
      }
      const extracted = await new IsolatedDocumentExtractor().extract({
        kind: parserKind,
        scanStatus: "CLEAN",
        source: result.stream,
      });
      segments = extracted.segments;
      pageCount = extracted.pageCount;
    }

    if (!segments.length) {
      return NextResponse.json(
        {
          code: "DOCUMENT_PARSE_FAILED",
          message:
            "The document was found, but no readable text was extracted.",
        },
        { status: 422, headers: noStore },
      );
    }

    return NextResponse.json(
      {
        kind,
        fileName: result.document.fileName,
        mediaType: result.document.mediaType,
        pageCount,
        segments,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof OpenApplicationDocumentError) {
      const notFound = error.code === "UNAVAILABLE";
      return NextResponse.json(
        {
          code: notFound ? "DOCUMENT_NOT_FOUND" : "PREVIEW_UNAVAILABLE",
          message: notFound
            ? "The document is not available."
            : "Parsed preview is unavailable for this document.",
        },
        { status: notFound ? 404 : 409, headers: noStore },
      );
    }
    if (error instanceof DocumentExtractionError) {
      return NextResponse.json(
        {
          code: "DOCUMENT_PARSE_FAILED",
          message: "Couldn't load document — try downloading the original.",
        },
        { status: 422, headers: noStore },
      );
    }
    return NextResponse.json(
      {
        code: "DOCUMENT_PREVIEW_UNAVAILABLE",
        message: "Couldn't load document — try downloading the original.",
      },
      { status: 500, headers: noStore },
    );
  }
}
