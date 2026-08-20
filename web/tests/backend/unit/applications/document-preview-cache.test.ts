import { afterEach, describe, expect, it } from "vitest";
import {
  clearCachedDocumentPreviews,
  getCachedDocumentPreview,
  setCachedDocumentPreview,
} from "@/backend/applications/services/document-preview-cache";
import { structuredDocumentPreviewSchema } from "@/shared/contracts/applications/document-preview";

const cachePrefix = "cache-schema-regression";

afterEach(() => clearCachedDocumentPreviews(cachePrefix));

describe("document preview cache", () => {
  it("returns a schema-safe payload on a cache hit", () => {
    setCachedDocumentPreview(`${cachePrefix}:cv`, {
      kind: "cv",
      previewStatus: "PARSED",
      fileName: "candidate-cv.pdf",
      mediaType: "application/pdf",
      pageCount: 1,
      parserVersion: "structured-preview-v3",
      processingMilliseconds: 12,
      cacheHit: false,
      content: {
        kind: "cv",
        name: "Candidate",
        title: "Developer",
        contact: [],
        summary: null,
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        qualityNotes: [],
      },
    });

    const cached = getCachedDocumentPreview(`${cachePrefix}:cv`);

    expect(cached).not.toBeNull();
    expect(cached).not.toHaveProperty("cachedAt");
    expect(cached?.cacheHit).toBe(true);
    expect(() => structuredDocumentPreviewSchema.parse(cached)).not.toThrow();
  });
});
