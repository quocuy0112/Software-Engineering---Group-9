import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { IsolatedDocumentExtractor } from "@/backend/cv/extraction/document-extractor";
import { PrivateRasterWorkspace } from "@/backend/cv/extraction/private-raster-workspace";
import { createSyntheticPdf } from "../../../helpers/cv-document-buffers";

describe("hybrid extraction child boundary", () => {
  it("returns a complete image-only PDF manifest and private raster", async () => {
    const extracted = await new IsolatedDocumentExtractor().extract({
      kind: "PDF",
      scanStatus: "CLEAN",
      source: createSyntheticPdf(""),
    });
    expect(extracted.segments).toEqual([]);
    expect(extracted.manifest).toMatchObject({
      schemaVersion: "cv-extraction-manifest-v1",
      documentKind: "PDF",
      pageCount: 1,
      eligibleImageCount: 1,
    });
    const path = extracted.manifest?.units[0]?.privateNormalizedPngPath;
    expect(path).toBeTruthy();
    await expect(access(path!)).resolves.toBeUndefined();
    await PrivateRasterWorkspace.disposeOwned(
      extracted.privateRasterWorkspacePath!,
    );
    await expect(access(path!)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
