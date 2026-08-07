import "server-only";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { CvExtractionManifest } from "@/shared/contracts/ocr/cv-extraction";
import { cvExtractionManifestSchema } from "@/shared/contracts/ocr/cv-extraction";
import { DocumentExtractionError } from "./document-extractor";
import type { PrivateRasterWorkspace } from "./private-raster-workspace";

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/gu;
const RENDER_DPI = 200;
const MAX_LONG_EDGE = 4_096;
const MAX_PIXELS = 20_000_000;

type PdfTextItem = Readonly<{
  str: string;
  transform: readonly number[];
}>;

function classifyNativeText(text: string, suspicious: boolean) {
  const visibleCharacters = text.match(LETTER_OR_DIGIT)?.length ?? 0;
  if (suspicious) return "OCR_REQUIRED_SUSPICIOUS" as const;
  if (visibleCharacters === 0) return "OCR_REQUIRED_EMPTY" as const;
  if (visibleCharacters < 40) return "OCR_REQUIRED_SPARSE" as const;
  return "NATIVE_SUFFICIENT" as const;
}

function normalizedText(items: readonly unknown[]) {
  return items
    .map((item) =>
      typeof item === "object" && item !== null && "str" in item
        ? String((item as PdfTextItem).str)
        : "",
    )
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasSuspiciousPlacement(
  items: readonly unknown[],
  width: number,
  height: number,
) {
  const textItems = items.filter(
    (item): item is PdfTextItem =>
      typeof item === "object" && item !== null && "str" in item,
  );
  if (!textItems.length) return false;
  const invalid = textItems.reduce(
    (count, item) => count + (item.str.match(/\uFFFD/gu)?.length ?? 0),
    0,
  );
  const characters = textItems.reduce(
    (count, item) => count + item.str.length,
    0,
  );
  if (characters > 0 && invalid / characters > 0.1) return true;
  const outside = textItems.filter((item) => {
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    return x < 0 || y < 0 || x > width || y > height;
  }).length;
  return outside / textItems.length > 0.5;
}

async function renderPage(
  page: Awaited<
    ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>
  >,
  unitKey: string,
  workspace: PrivateRasterWorkspace,
) {
  const natural = page.getViewport({ scale: RENDER_DPI / 72 });
  const edgeScale = Math.min(
    1,
    MAX_LONG_EDGE / Math.max(natural.width, natural.height),
  );
  const pixelScale = Math.min(
    1,
    Math.sqrt(MAX_PIXELS / (natural.width * natural.height)),
  );
  const viewport = page.getViewport({
    scale: (RENDER_DPI / 72) * Math.min(edgeScale, pixelScale),
  });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  await page.render({
    canvas: canvas as never,
    canvasContext: context as never,
    viewport,
    background: "white",
  }).promise;
  const bytes = canvas.toBuffer("image/png");
  return {
    path: await workspace.writePng(unitKey, bytes),
    pixels: width * height,
  };
}

export async function createPdfOcrManifest(input: {
  source: Uint8Array;
  workspace: PrivateRasterWorkspace;
}): Promise<CvExtractionManifest> {
  const document = await getDocument({ data: Uint8Array.from(input.source) })
    .promise;
  try {
    if (document.numPages < 1) throw new DocumentExtractionError("EMPTY_TEXT");
    if (document.numPages > 20) throw new DocumentExtractionError("PAGE_LIMIT");
    const units: CvExtractionManifest["units"][number][] = [];
    let eligiblePixels = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent({
          disableNormalization: false,
        });
        const text = normalizedText(content.items);
        const classification = classifyNativeText(
          text,
          hasSuspiciousPlacement(
            content.items,
            viewport.width,
            viewport.height,
          ),
        );
        const unitKey = `pdf-page-${pageNumber}`;
        const raster =
          classification === "NATIVE_SUFFICIENT"
            ? null
            : await renderPage(page, unitKey, input.workspace);
        eligiblePixels += raster?.pixels ?? 0;
        units.push({
          unitKey,
          ordinal: pageNumber - 1,
          kind: "PDF_PAGE",
          classification,
          nativeSegments: text
            ? [{ id: `${unitKey}-native-1`, kind: "paragraph", text }]
            : [],
          pageNumber,
          bodyOrdinal: null,
          imageOrdinal: null,
          anchorSegmentId: null,
          anchorQuality: "PAGE_ONLY",
          privateNormalizedPngPath: raster?.path ?? null,
          sourceDecodedPixels: raster?.pixels ?? null,
        });
      } finally {
        page.cleanup();
      }
    }
    return cvExtractionManifestSchema.parse({
      schemaVersion: "cv-extraction-manifest-v1",
      documentKind: "PDF",
      eligibilityPolicyVersion: "cv-ocr-eligibility-v1",
      pageCount: document.numPages,
      entryCount: null,
      expandedBytes: input.source.byteLength,
      eligibleImageCount: units.filter(
        (unit) => unit.classification !== "NATIVE_SUFFICIENT",
      ).length,
      eligibleImageDecodedPixels: eligiblePixels,
      units,
    });
  } finally {
    await document.cleanup();
  }
}
