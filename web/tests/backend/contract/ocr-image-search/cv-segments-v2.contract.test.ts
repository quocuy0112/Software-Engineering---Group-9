import { describe, expect, it } from "vitest";

import {
  CV_SEGMENT_SCHEMA_VERSION,
  cvSegmentV2Schema,
} from "@/shared/contracts/ocr/cv-segments-v2";

const nativeSegment = {
  schemaVersion: CV_SEGMENT_SCHEMA_VERSION,
  id: "pdf-page-1-native-1",
  order: 0,
  kind: "paragraph" as const,
  text: "Senior Platform Engineer",
  source: {
    method: "NATIVE" as const,
    unitKind: "PDF_PAGE" as const,
    unitKey: "pdf-page-1",
    pageNumber: 1,
    bodyOrdinal: null,
    imageOrdinal: null,
    anchorQuality: "PAGE_ONLY" as const,
  },
  confidence: { level: "NATIVE" as const, average: null, minimum: null },
  versions: {
    eligibilityPolicy: "cv-ocr-eligibility-v1" as const,
    confidencePolicy: "ocr-confidence-v1" as const,
    deduplicationPolicy: "cv-segment-dedup-v1" as const,
    ocrEngine: null,
    ocrModel: null,
  },
  warnings: [],
};

describe("cv-segments-v2 CV behavior boundary", () => {
  it("preserves ordered native provenance without OCR metadata", () => {
    expect(cvSegmentV2Schema.parse(nativeSegment)).toEqual(nativeSegment);
  });

  it("rejects mismatched PDF/DOCX locations and unknown fields", () => {
    expect(() =>
      cvSegmentV2Schema.parse({
        ...nativeSegment,
        source: { ...nativeSegment.source, bodyOrdinal: 1 },
      }),
    ).toThrow();
    expect(() =>
      cvSegmentV2Schema.parse({ ...nativeSegment, ownership: "candidate" }),
    ).toThrow();
  });

  it("rejects OCR metadata on native segments", () => {
    expect(() =>
      cvSegmentV2Schema.parse({
        ...nativeSegment,
        versions: { ...nativeSegment.versions, ocrEngine: "paddleocr-onnx" },
      }),
    ).toThrow();
  });
});
