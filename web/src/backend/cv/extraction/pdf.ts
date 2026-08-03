import "server-only";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  DocumentExtractionError,
  type ExtractionChildResult,
} from "./document-extractor";

type Limits = Readonly<{
  maximumPdfPages: number;
  maximumOutputBytes: number;
}>;

function rejectStaticActiveContent(source: Uint8Array) {
  const raw = Buffer.from(source).toString("latin1");
  if (/\/Encrypt\b/u.test(raw)) throw new DocumentExtractionError("ENCRYPTED");
  if (/\/(?:JavaScript|JS|Launch|RichMedia)\b/u.test(raw))
    throw new DocumentExtractionError("ACTIVE_CONTENT");
  if (/\/(?:EmbeddedFile|EmbeddedFiles)\b/u.test(raw))
    throw new DocumentExtractionError("EMBEDDED_CONTENT");
}

export async function extractPdf(
  source: Uint8Array,
  limits: Limits,
): Promise<ExtractionChildResult> {
  if (
    !Buffer.from(source.subarray(0, 8)).toString("latin1").startsWith("%PDF-")
  )
    throw new DocumentExtractionError("MALFORMED_DOCUMENT");
  rejectStaticActiveContent(source);
  let document: Awaited<ReturnType<typeof getDocument>["promise"]>;
  try {
    document = await getDocument({
      data: Uint8Array.from(source),
    }).promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (/Password/u.test(name)) throw new DocumentExtractionError("ENCRYPTED");
    throw new DocumentExtractionError("MALFORMED_DOCUMENT");
  }
  try {
    if (document.numPages < 1) throw new DocumentExtractionError("EMPTY_TEXT");
    if (document.numPages > limits.maximumPdfPages)
      throw new DocumentExtractionError("PAGE_LIMIT");
    const attachments = await document.getAttachments();
    if (attachments && Object.keys(attachments).length)
      throw new DocumentExtractionError("EMBEDDED_CONTENT");
    const javaScript = await document.getJSActions();
    if (javaScript && Object.keys(javaScript).length)
      throw new DocumentExtractionError("ACTIVE_CONTENT");
    const segments = [];
    let outputBytes = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({
        disableNormalization: false,
      });
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .normalize("NFKC")
        .replace(/\s+/gu, " ")
        .trim();
      if (!text) continue;
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > limits.maximumOutputBytes)
        throw new DocumentExtractionError("OUTPUT_LIMIT");
      segments.push({
        id: `pdf-page-${pageNumber}`,
        kind: "paragraph" as const,
        text,
      });
      page.cleanup();
    }
    if (!segments.length) throw new DocumentExtractionError("IMAGE_ONLY");
    return {
      segments,
      pageCount: document.numPages,
      entryCount: null,
      expandedBytes: source.byteLength,
    };
  } finally {
    await document.cleanup();
  }
}
