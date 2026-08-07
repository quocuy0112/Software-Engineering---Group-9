import { describe, expect, it } from "vitest";

import { createPdfOcrManifest } from "@/backend/cv/extraction/pdf-ocr-manifest";
import { PrivateRasterWorkspace } from "@/backend/cv/extraction/private-raster-workspace";
import { createSyntheticPdf } from "../../../helpers/cv-document-buffers";

describe("cv-ocr-eligibility-v1 PDF manifest", () => {
  it("keeps sufficient native pages independent from raster/OCR", async () => {
    const workspace = await PrivateRasterWorkspace.create();
    try {
      const manifest = await createPdfOcrManifest({
        source: createSyntheticPdf(
          "Senior platform engineer building secure distributed systems in TypeScript and PostgreSQL",
        ),
        workspace,
      });
      expect(manifest.units).toHaveLength(1);
      expect(manifest.units[0]).toMatchObject({
        unitKey: "pdf-page-1",
        ordinal: 0,
        pageNumber: 1,
        classification: "NATIVE_SUFFICIENT",
        privateNormalizedPngPath: null,
      });
    } finally {
      await workspace.dispose();
    }
  });

  it("accounts for and renders an empty page at 200 DPI", async () => {
    const workspace = await PrivateRasterWorkspace.create();
    try {
      const manifest = await createPdfOcrManifest({
        source: createSyntheticPdf(""),
        workspace,
      });
      expect(manifest.pageCount).toBe(1);
      expect(manifest.units[0]).toMatchObject({
        classification: "OCR_REQUIRED_EMPTY",
        sourceDecodedPixels: expect.any(Number),
      });
      expect(manifest.units[0]?.privateNormalizedPngPath).toContain(
        workspace.path,
      );
    } finally {
      await workspace.dispose();
    }
  });
});
