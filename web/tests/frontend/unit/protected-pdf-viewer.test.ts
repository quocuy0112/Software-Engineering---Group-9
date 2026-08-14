import { describe, expect, it, vi } from "vitest";

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  workerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist", () => ({
  getDocument: pdfjs.getDocument,
  GlobalWorkerOptions: pdfjs.workerOptions,
}));

import { loadProtectedPdf } from "@/client-vendors/protected-pdf-viewer";

describe("protected PDF viewer loader", () => {
  it("configures a bundled PDF.js worker before loading protected bytes", async () => {
    const document = { numPages: 1 };
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(document) });

    const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
    await expect(loadProtectedPdf(bytes)).resolves.toBe(document);

    expect(pdfjs.workerOptions.workerSrc).toContain("pdf.worker.min.mjs");
    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    });
  });
});
