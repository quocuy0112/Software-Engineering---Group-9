import { describe, expect, it, vi } from "vitest";

import { DeterministicCvParser } from "@/backend/cv/parsing/deterministic";
import { CreateCvDraftService } from "@/backend/services/cv-import/create-cv-draft";
import type { CvSegmentV2 } from "@/shared/contracts/ocr/cv-segments-v2";

function segment(
  confidence: "HIGH" | "LOW",
  warnings: CvSegmentV2["warnings"],
): CvSegmentV2 {
  return {
    schemaVersion: "cv-segments-v2",
    id: "pdf-page-1-ocr-1",
    order: 0,
    kind: "paragraph",
    text: "Platform Engineer TypeScript",
    source: {
      method: "OCR",
      unitKind: "PDF_PAGE",
      unitKey: "pdf-page-1",
      pageNumber: 1,
      bodyOrdinal: null,
      imageOrdinal: null,
      anchorQuality: "PAGE_ONLY",
    },
    confidence: {
      level: confidence,
      average: confidence === "HIGH" ? 0.96 : 0.4,
      minimum: confidence === "HIGH" ? 0.94 : 0.3,
    },
    versions: {
      eligibilityPolicy: "cv-ocr-eligibility-v1",
      confidencePolicy: "ocr-confidence-v1",
      deduplicationPolicy: "cv-segment-dedup-v1",
      ocrEngine: "paddleocr-onnx",
      ocrModel: "PP-OCRv6-medium",
    },
    warnings,
  };
}

describe("cv-draft-v2 review boundary", () => {
  it("stores review-visible OCR provenance without any Profile write", async () => {
    const parser = new DeterministicCvParser({ environment: "test" });
    const segments = [
      segment("HIGH", ["MATERIAL_NATIVE_OCR_CONFLICT"]),
    ] as const;
    const parsed = await parser.parse({ segments });
    const saveDraft = vi.fn(async (draft) => draft);
    let sequence = 0;
    const service = new CreateCvDraftService({
      saveDraft,
      newId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    });
    const draft = await service.execute({
      accountId: "account-12345",
      uploadId: "upload-12345",
      parseJobId: "parse-12345",
      profileId: "profile-12345",
      sourceProfileRevision: 7,
      output: parsed.output,
      segments,
      expiresAt: new Date("2026-08-07T00:00:00.000Z"),
    });
    expect(draft.schemaVersion).toBe("cv-draft-v2");
    expect(JSON.stringify(draft.provenancePayload)).toContain(
      "MATERIAL_NATIVE_OCR_CONFLICT",
    );
    expect(saveDraft).toHaveBeenCalledOnce();
  });

  it("never auto-populates a proposal from uncorroborated LOW OCR", async () => {
    const parsed = await new DeterministicCvParser({
      environment: "test",
    }).parse({
      segments: [segment("LOW", ["LOW_CONFIDENCE"])],
    });
    expect(parsed.output).toMatchObject({
      schemaVersion: "cv-draft-v2",
      scalars: { headline: null },
      skills: [],
    });
  });
});
