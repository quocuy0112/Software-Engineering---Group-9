"use client";

let workerConfigured = false;

function configureWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (workerConfigured) return;

  // Next bundles this module-relative worker as a same-origin asset. Without
  // an explicit worker URL PDF.js falls back to a fake worker, which fails in
  // the browser when the protected PDF is loaded from an authenticated route.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  workerConfigured = true;
}

export async function loadProtectedPdf(data: ArrayBuffer) {
  // Keep PDF.js out of the initial client module graph. Its browser build
  // touches DOMMatrix during module evaluation, which is unavailable during
  // server rendering and in the jsdom test environment.
  const pdfjs = await import("pdfjs-dist");
  configureWorker(pdfjs);
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}
