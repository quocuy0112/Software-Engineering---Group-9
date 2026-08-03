import { describe, expect, it, vi } from "vitest";

import {
  IsolatedDocumentExtractor,
  type ExtractionChildRequest,
} from "@/backend/cv/extraction/document-extractor";
import {
  createSyntheticDocx,
  createSyntheticPdf,
} from "../../../helpers/cv-document-buffers";

function extractor() {
  const runChild = vi.fn(async (request: ExtractionChildRequest) => ({
    segments: [
      { id: "segment-1", kind: "paragraph" as const, text: "Synthetic CV" },
    ],
    pageCount: request.kind === "PDF" ? 1 : null,
    entryCount: request.kind === "DOCX" ? 3 : null,
    expandedBytes: 128,
  }));
  return { extractor: new IsolatedDocumentExtractor({ runChild }), runChild };
}

describe("post-CLEAN isolated document extraction", () => {
  it.each([
    ["PDF" as const, createSyntheticPdf()],
    ["DOCX" as const, createSyntheticDocx()],
  ])(
    "extracts a real clean %s fixture in the bounded child",
    async (kind, source) => {
      const result = await new IsolatedDocumentExtractor().extract({
        kind,
        scanStatus: "CLEAN",
        source,
      });
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]?.text).toContain("Synthetic Platform Engineer");
    },
  );

  it("never invokes a PDF/ZIP/XML child before persisted CLEAN", async () => {
    const fixture = extractor();
    for (const scanStatus of [
      "QUEUED",
      "PROCESSING",
      "INFECTED",
      "INDETERMINATE",
    ] as const) {
      await expect(
        fixture.extractor.extract({
          kind: "PDF",
          scanStatus,
          source: Buffer.from("%PDF-1.7"),
        }),
      ).rejects.toMatchObject({ code: "CV_EXTRACTION_REQUIRES_CLEAN_SCAN" });
    }
    expect(fixture.runChild).not.toHaveBeenCalled();
  });

  it.each([
    "POLYGLOT",
    "ENCRYPTED",
    "ACTIVE_CONTENT",
    "EMBEDDED_CONTENT",
    "IMAGE_ONLY",
    "PAGE_LIMIT",
    "MALFORMED_ZIP",
    "TRAVERSAL",
    "DUPLICATE_PATH",
    "ZIP_BOMB",
    "ENTRY_LIMIT",
    "EXPANDED_LIMIT",
    "MACRO",
    "OLE",
    "ACTIVEX",
    "EXTERNAL_RELATIONSHIP",
    "EMPTY_TEXT",
    "OUTPUT_LIMIT",
  ])(
    "discards partial output for unsafe structure: %s",
    async (failureCode) => {
      const fixture = extractor();
      fixture.runChild.mockRejectedValueOnce(
        Object.assign(new Error("unsafe"), { code: failureCode }),
      );
      await expect(
        fixture.extractor.extract({
          kind: failureCode.includes("ZIP") ? "DOCX" : "PDF",
          scanStatus: "CLEAN",
          source: Buffer.from("synthetic"),
        }),
      ).rejects.toMatchObject({ code: failureCode });
    },
  );

  it("enforces 15-second/192-MiB isolation and 512-KiB normalized output", () => {
    const fixture = extractor();
    expect(fixture.extractor.limits).toEqual({
      timeoutMs: 15_000,
      maximumOldSpaceMb: 192,
      maximumOutputBytes: 512 * 1024,
      maximumPdfPages: 20,
      maximumDocxEntries: 1_000,
      maximumDocxExpandedBytes: 25 * 1024 * 1024,
    });
  });
});
