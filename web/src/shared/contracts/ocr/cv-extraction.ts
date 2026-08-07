import { z } from "zod";

export const CV_EXTRACTION_MANIFEST_VERSION =
  "cv-extraction-manifest-v1" as const;

export const cvUnitClassificationSchema = z.enum([
  "NATIVE_SUFFICIENT",
  "OCR_REQUIRED_EMPTY",
  "OCR_REQUIRED_SPARSE",
  "OCR_REQUIRED_SUSPICIOUS",
  "ELIGIBLE_BODY_IMAGE",
  "EXCLUDED_NON_BODY_IMAGE",
  "EXCLUDED_UNSUPPORTED_IMAGE",
  "NON_TEXT",
]);

export const nativeCvSegmentSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/u),
    kind: z.enum(["heading", "paragraph", "list-item"]),
    text: z.string().min(1).max(65_536),
  })
  .strict();

export const cvExtractionUnitSchema = z
  .object({
    unitKey: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/u),
    ordinal: z.number().int().min(0).max(10_000),
    kind: z.enum(["PDF_PAGE", "DOCX_BODY_IMAGE"]),
    classification: cvUnitClassificationSchema,
    nativeSegments: z.array(nativeCvSegmentSchema).max(10_000),
    pageNumber: z.number().int().min(1).max(20).nullable(),
    bodyOrdinal: z.number().int().min(0).max(10_000).nullable(),
    // The 20-item cap applies only to eligible OCR images. Excluded body
    // relationships are still accounted for and may therefore have a larger
    // source ordinal.
    imageOrdinal: z.number().int().min(0).max(10_000).nullable(),
    anchorSegmentId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,100}$/u)
      .nullable(),
    anchorQuality: z.enum([
      "EXACT",
      "APPROXIMATE",
      "PAGE_ONLY",
      "NOT_APPLICABLE",
    ]),
    privateNormalizedPngPath: z.string().min(1).max(1_024).nullable(),
    sourceDecodedPixels: z.number().int().min(1).max(100_000_000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const pdfLocation =
      value.kind === "PDF_PAGE" &&
      value.pageNumber !== null &&
      value.bodyOrdinal === null &&
      value.imageOrdinal === null;
    const docxLocation =
      value.kind === "DOCX_BODY_IMAGE" &&
      value.pageNumber === null &&
      value.bodyOrdinal !== null &&
      value.imageOrdinal !== null;
    if (!pdfLocation && !docxLocation)
      context.addIssue({ code: "custom", message: "Invalid unit location" });

    const requiresRaster = [
      "OCR_REQUIRED_EMPTY",
      "OCR_REQUIRED_SPARSE",
      "OCR_REQUIRED_SUSPICIOUS",
      "ELIGIBLE_BODY_IMAGE",
    ].includes(value.classification);
    if (
      requiresRaster !==
      Boolean(value.privateNormalizedPngPath && value.sourceDecodedPixels)
    )
      context.addIssue({
        code: "custom",
        message: "Eligible OCR units require one private normalized raster",
      });
  });

export const cvExtractionManifestSchema = z
  .object({
    schemaVersion: z.literal(CV_EXTRACTION_MANIFEST_VERSION),
    documentKind: z.enum(["PDF", "DOCX"]),
    eligibilityPolicyVersion: z.literal("cv-ocr-eligibility-v1"),
    pageCount: z.number().int().min(1).max(20).nullable(),
    entryCount: z.number().int().min(1).max(1_000).nullable(),
    expandedBytes: z
      .number()
      .int()
      .min(1)
      .max(25 * 1024 * 1024),
    eligibleImageCount: z.number().int().min(0).max(20),
    eligibleImageDecodedPixels: z.number().int().min(0).max(100_000_000),
    units: z.array(cvExtractionUnitSchema).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    const ordinals = value.units.map((unit) => unit.ordinal);
    if (ordinals.some((ordinal, index) => ordinal !== index))
      context.addIssue({ code: "custom", message: "Unit order must be dense" });
    if (
      new Set(value.units.map((unit) => unit.unitKey)).size !==
      value.units.length
    )
      context.addIssue({ code: "custom", message: "Unit keys must be unique" });
    if (
      value.documentKind === "PDF" &&
      (value.pageCount === null || value.units.length !== value.pageCount)
    )
      context.addIssue({
        code: "custom",
        message: "Every PDF page is required",
      });
  });

export type CvUnitClassification = z.infer<typeof cvUnitClassificationSchema>;
export type NativeCvSegment = z.infer<typeof nativeCvSegmentSchema>;
export type CvExtractionUnit = z.infer<typeof cvExtractionUnitSchema>;
export type CvExtractionManifest = z.infer<typeof cvExtractionManifestSchema>;
