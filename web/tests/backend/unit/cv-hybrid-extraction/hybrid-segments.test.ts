import { describe, expect, it } from "vitest";

import { mergeHybridCvSegments } from "@/backend/cv/extraction/hybrid-segments";
import type { CvExtractionManifest } from "@/shared/contracts/ocr/cv-extraction";
import type { OcrRecognitionResult } from "@/shared/contracts/ocr/recognition";

const engine = {
  name: "paddleocr-onnx" as const,
  version: "1.0.0",
  runtimeName: "onnxruntime" as const,
  runtimeVersion: "1.27.0" as const,
  modelName: "PP-OCRv6-medium" as const,
  modelManifestSha256: "a".repeat(64),
};

function recognition(text: string, confidence: number): OcrRecognitionResult {
  return {
    schemaVersion: "ocr-lines-v1",
    attemptId: "attempt-12345",
    purpose: "CV_IMPORT",
    engine,
    image: {
      width: 100,
      height: 100,
      decodedPixels: 10_000,
      detectedOrientationDegrees: 0,
    },
    lines: text
      ? [
          {
            id: "line-0",
            order: 0,
            text,
            confidence,
            polygon: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        ]
      : [],
    summary: {
      lineCount: text ? 1 : 0,
      utf8Bytes: Buffer.byteLength(text),
      averageConfidence: text ? confidence : null,
      minimumConfidence: text ? confidence : null,
    },
  };
}

const manifest: CvExtractionManifest = {
  schemaVersion: "cv-extraction-manifest-v1",
  documentKind: "PDF",
  eligibilityPolicyVersion: "cv-ocr-eligibility-v1",
  pageCount: 1,
  entryCount: null,
  expandedBytes: 100,
  eligibleImageCount: 1,
  eligibleImageDecodedPixels: 10_000,
  units: [
    {
      unitKey: "pdf-page-1",
      ordinal: 0,
      kind: "PDF_PAGE",
      classification: "OCR_REQUIRED_SUSPICIOUS",
      nativeSegments: [
        {
          id: "pdf-page-1-native-1",
          kind: "paragraph",
          text: "Backend Platform Engineer Java",
        },
      ],
      pageNumber: 1,
      bodyOrdinal: null,
      imageOrdinal: null,
      anchorSegmentId: null,
      anchorQuality: "PAGE_ONLY",
      privateNormalizedPngPath: "C:/private/page.png",
      sourceDecodedPixels: 10_000,
    },
  ],
};

describe("cv-segment-dedup-v1 hybrid merge", () => {
  it("keeps native and conflicting OCR evidence in deterministic order", () => {
    const result = mergeHybridCvSegments({
      manifest,
      recognizedUnits: new Map([
        ["pdf-page-1", recognition("Frontend Designer Figma", 0.95)],
      ]),
      maximumUtf8Bytes: 512 * 1024,
    });
    expect(result.segments.map((segment) => segment.source.method)).toEqual([
      "NATIVE",
      "OCR",
    ]);
    expect(result.conflictUnitCount).toBe(1);
    expect(result.segments.every((segment) => segment.order >= 0)).toBe(true);
  });

  it("deduplicates exact OCR/native text and flags low confidence", () => {
    const duplicate = mergeHybridCvSegments({
      manifest,
      recognizedUnits: new Map([
        ["pdf-page-1", recognition("Backend Platform Engineer Java", 0.95)],
      ]),
      maximumUtf8Bytes: 512 * 1024,
    });
    expect(duplicate.segments).toHaveLength(1);
    expect(duplicate.ocrSegmentCount).toBe(1);
    expect(duplicate.segments[0]?.warnings).toContain(
      "DEDUPLICATED_WITH_NATIVE",
    );

    const low = mergeHybridCvSegments({
      manifest: {
        ...manifest,
        units: [{ ...manifest.units[0]!, nativeSegments: [] }],
      },
      recognizedUnits: new Map([
        ["pdf-page-1", recognition("Uncertain content", 0.4)],
      ]),
      maximumUtf8Bytes: 512 * 1024,
    });
    expect(low.lowConfidenceUnitCount).toBe(1);
    expect(low.segments[0]?.warnings).toContain("LOW_CONFIDENCE");
  });

  it("preserves every native subsegment when aggregate OCR is an exact duplicate", () => {
    const split = mergeHybridCvSegments({
      manifest: {
        ...manifest,
        units: [
          {
            ...manifest.units[0]!,
            nativeSegments: [
              {
                id: "native-heading",
                kind: "heading",
                text: "Backend Platform Engineer",
              },
              { id: "native-skill", kind: "paragraph", text: "Java" },
            ],
          },
        ],
      },
      recognizedUnits: new Map([
        ["pdf-page-1", recognition("Backend Platform Engineer Java", 0.95)],
      ]),
      maximumUtf8Bytes: 512 * 1024,
    });
    expect(split.segments.map((segment) => segment.text)).toEqual([
      "Backend Platform Engineer",
      "Java",
    ]);
    expect(split.segments.map((segment) => segment.source.method)).toEqual([
      "NATIVE_AND_OCR",
      "NATIVE",
    ]);
  });

  it("rejects missing, extra, or oversized OCR output", () => {
    expect(() =>
      mergeHybridCvSegments({
        manifest,
        recognizedUnits: new Map(),
        maximumUtf8Bytes: 512 * 1024,
      }),
    ).toThrow("CV_OCR_UNIT_MISSING");
    expect(() =>
      mergeHybridCvSegments({
        manifest,
        recognizedUnits: new Map([
          ["pdf-page-1", recognition("x".repeat(100), 0.9)],
        ]),
        maximumUtf8Bytes: 10,
      }),
    ).toThrow("CV_SEGMENT_LIMIT_EXCEEDED");
  });
});
