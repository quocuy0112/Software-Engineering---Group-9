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

type PositionedTextItem = Readonly<{
  text: string;
  x: number;
  y: number;
  fontSize: number;
  hasEOL: boolean;
  order: number;
}>;

function textItem(value: unknown, order: number): PositionedTextItem | null {
  if (!value || typeof value !== "object" || !("str" in value)) return null;
  const text = typeof value.str === "string" ? value.str.trim() : "";
  if (!text) return null;
  const transform =
    "transform" in value && Array.isArray(value.transform)
      ? value.transform
      : null;
  const x = Number(transform?.[4]);
  const y = Number(transform?.[5]);
  const fontSize = Math.max(
    Math.abs(Number(transform?.[0])) || 0,
    Math.abs(Number(transform?.[3])) || 0,
    1,
  );
  return {
    text,
    x: Number.isFinite(x) ? x : Number.NaN,
    y: Number.isFinite(y) ? y : Number.NaN,
    fontSize,
    hasEOL: "hasEOL" in value && value.hasEOL === true,
    order,
  };
}

/**
 * PDF.js exposes text as positioned fragments. Joining every fragment with a
 * space loses the visual line structure, which is especially noticeable for
 * cover letters. Rebuild lines from the baseline and retain a safe fallback
 * for PDFs that do not expose usable transforms.
 */
function pageText(items: readonly unknown[]) {
  const extracted = items.flatMap((item, index) => {
    const value = textItem(item, index);
    return value ? [value] : [];
  });
  if (!extracted.length) return "";

  if (extracted.some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y))) {
    return extracted
      .map((item) => item.text + (item.hasEOL ? "\n" : " "))
      .join("")
      .replace(/[ \t]+/gu, " ")
      .replace(/ *\n */gu, "\n")
      .trim();
  }

  const ordered = extracted
    .slice()
    .sort(
      (left, right) =>
        right.y - left.y || left.x - right.x || left.order - right.order,
    );
  const lines: Array<{
    y: number;
    fontSize: number;
    hasEOL: boolean;
    items: PositionedTextItem[];
  }> = [];

  for (const item of ordered) {
    const previous = lines.at(-1);
    const tolerance = Math.max(
      2,
      Math.min(6, (previous?.fontSize ?? item.fontSize) * 0.35),
    );
    if (!previous || previous.hasEOL || Math.abs(previous.y - item.y) > tolerance) {
      lines.push({
        y: item.y,
        fontSize: item.fontSize,
        hasEOL: item.hasEOL,
        items: [item],
      });
      continue;
    }
    previous.items.push(item);
    previous.hasEOL = item.hasEOL;
  }

  return lines
    .map((line) =>
      line.items
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

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
      const text = pageText(content.items)
        .normalize("NFKC")
        .replace(/[ \t]+/gu, " ")
        .replace(/ *\n */gu, "\n")
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
