import { z } from "zod";

export const CV_SEGMENT_SCHEMA_VERSION = "cv-segments-v2" as const;
export const CV_ELIGIBILITY_POLICY_VERSION = "cv-ocr-eligibility-v1" as const;
export const OCR_CONFIDENCE_POLICY_VERSION = "ocr-confidence-v1" as const;
export const CV_DEDUPLICATION_POLICY_VERSION = "cv-segment-dedup-v1" as const;

const nullableBoundedInteger = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum).nullable();

const cvSegmentSourceSchema = z
  .object({
    method: z.enum(["NATIVE", "OCR", "NATIVE_AND_OCR"]),
    unitKind: z.enum(["PDF_PAGE", "DOCX_BODY_IMAGE"]),
    unitKey: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/u),
    pageNumber: nullableBoundedInteger(1, 20),
    bodyOrdinal: nullableBoundedInteger(0, 10_000),
    imageOrdinal: nullableBoundedInteger(0, 19),
    anchorQuality: z.enum([
      "EXACT",
      "APPROXIMATE",
      "PAGE_ONLY",
      "NOT_APPLICABLE",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    const validLocation =
      (value.unitKind === "PDF_PAGE" &&
        value.pageNumber !== null &&
        value.bodyOrdinal === null &&
        value.imageOrdinal === null) ||
      (value.unitKind === "DOCX_BODY_IMAGE" &&
        value.pageNumber === null &&
        value.bodyOrdinal !== null &&
        value.imageOrdinal !== null);
    if (!validLocation) {
      context.addIssue({
        code: "custom",
        message: "Invalid CV source location",
      });
    }
  });

export const cvSegmentV2Schema = z
  .object({
    schemaVersion: z.literal(CV_SEGMENT_SCHEMA_VERSION),
    id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/u),
    order: z.number().int().min(0).max(10_000),
    kind: z.enum(["heading", "paragraph", "list-item"]),
    text: z.string().min(1).max(65_536),
    source: cvSegmentSourceSchema,
    confidence: z
      .object({
        level: z.enum(["NATIVE", "HIGH", "REVIEW", "LOW"]),
        average: z.number().finite().min(0).max(1).nullable(),
        minimum: z.number().finite().min(0).max(1).nullable(),
      })
      .strict(),
    versions: z
      .object({
        eligibilityPolicy: z.literal(CV_ELIGIBILITY_POLICY_VERSION),
        confidencePolicy: z.literal(OCR_CONFIDENCE_POLICY_VERSION),
        deduplicationPolicy: z.literal(CV_DEDUPLICATION_POLICY_VERSION),
        ocrEngine: z.string().max(100).nullable(),
        ocrModel: z.string().max(160).nullable(),
      })
      .strict(),
    warnings: z
      .array(
        z.enum([
          "LOW_CONFIDENCE",
          "MATERIAL_NATIVE_OCR_CONFLICT",
          "APPROXIMATE_ANCHOR",
          "PARTIAL_UNIT_TEXT",
          "DEDUPLICATED_WITH_NATIVE",
        ]),
      )
      .max(8),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.warnings).size !== value.warnings.length) {
      context.addIssue({ code: "custom", message: "Warnings must be unique" });
    }
    if (
      value.source.method === "NATIVE" &&
      (value.confidence.level !== "NATIVE" ||
        value.confidence.average !== null ||
        value.confidence.minimum !== null ||
        value.versions.ocrEngine !== null ||
        value.versions.ocrModel !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Native segments cannot contain OCR metadata",
      });
    }
  });

export type CvSegmentV2 = z.infer<typeof cvSegmentV2Schema>;
