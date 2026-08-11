import "server-only";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import sharp from "sharp";

function installPdfCanvasGlobals() {
  const globalValues = globalThis as unknown as Record<string, unknown>;
  globalValues.DOMMatrix ??= DOMMatrix;
  globalValues.ImageData ??= ImageData;
  globalValues.Path2D ??= Path2D;
}

export async function normalizeBusinessEvidencePreview(
  bytes: Buffer,
  mediaType: string,
): Promise<Buffer> {
  if (mediaType !== "application/pdf") {
    return sharp(bytes, { failOn: "error", limitInputPixels: 25_000_000 })
      .rotate()
      .resize({
        width: 1_600,
        height: 2_000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  installPdfCanvasGlobals();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: Uint8Array.from(bytes) });
  try {
    const document = await loadingTask.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(
      Math.max(1, Math.ceil(viewport.width)),
      Math.max(1, Math.ceil(viewport.height)),
    );
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as never,
      canvasContext: context as never,
      viewport,
    }).promise;
    return canvas.toBuffer("image/png");
  } finally {
    await loadingTask.destroy();
  }
}
