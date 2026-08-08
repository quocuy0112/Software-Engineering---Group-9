import { z } from "zod";

export const OCR_RECOGNITION_SCHEMA_VERSION = "ocr-lines-v1" as const;
export const OCR_PURPOSES = ["CV_IMPORT", "JOB_IMAGE_SEARCH"] as const;
export const OCR_ENGINE_NAMES = ["paddleocr-onnx"] as const;
export const OCR_MODEL_NAMES = ["PP-OCRv6-medium"] as const;
export const OCR_RUNTIME_VERSION = "1.27.0" as const;
export const OCR_RESULT_MAX_LINES = 2_000;
export const OCR_RESULT_MAX_UTF8_BYTES = 65_536;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const boundedCoordinateSchema = z.number().finite().min(0).max(20_000_000);

export const ocrPurposeSchema = z.enum(OCR_PURPOSES);
export const ocrEngineManifestSchema = z
  .object({
    name: z.literal(OCR_ENGINE_NAMES[0]),
    version: z.string().min(1).max(40),
    runtimeName: z.literal("onnxruntime"),
    runtimeVersion: z.literal(OCR_RUNTIME_VERSION),
    modelName: z.literal(OCR_MODEL_NAMES[0]),
    modelManifestSha256: sha256Schema,
  })
  .strict();

export const ocrPointSchema = z
  .object({ x: boundedCoordinateSchema, y: boundedCoordinateSchema })
  .strict();

export const ocrLineSchema = z
  .object({
    id: z.string().regex(/^line-[0-9]{1,4}$/u),
    order: z
      .number()
      .int()
      .min(0)
      .max(OCR_RESULT_MAX_LINES - 1),
    text: z.string().min(1).max(4_096),
    confidence: z.number().finite().min(0).max(1),
    polygon: z.tuple([
      ocrPointSchema,
      ocrPointSchema,
      ocrPointSchema,
      ocrPointSchema,
    ]),
  })
  .strict();

export const ocrRecognitionResultSchema = z
  .object({
    schemaVersion: z.literal(OCR_RECOGNITION_SCHEMA_VERSION),
    attemptId: z.string().regex(/^[A-Za-z0-9_-]{10,80}$/u),
    purpose: ocrPurposeSchema,
    engine: ocrEngineManifestSchema,
    image: z
      .object({
        width: z.number().int().min(1).max(20_000_000),
        height: z.number().int().min(1).max(20_000_000),
        decodedPixels: z.number().int().min(1).max(20_000_000),
        detectedOrientationDegrees: z.union([
          z.literal(0),
          z.literal(90),
          z.literal(180),
          z.literal(270),
        ]),
      })
      .strict(),
    lines: z.array(ocrLineSchema).max(OCR_RESULT_MAX_LINES),
    summary: z
      .object({
        lineCount: z.number().int().min(0).max(OCR_RESULT_MAX_LINES),
        utf8Bytes: z.number().int().min(0).max(OCR_RESULT_MAX_UTF8_BYTES),
        averageConfidence: z.number().finite().min(0).max(1).nullable(),
        minimumConfidence: z.number().finite().min(0).max(1).nullable(),
        partial: z.boolean().default(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const orders = new Set<number>();
    const ids = new Set<string>();
    let utf8Bytes = 0;
    let confidenceTotal = 0;
    let minimumConfidence = 1;
    for (const line of value.lines) {
      if (orders.has(line.order) || ids.has(line.id)) {
        context.addIssue({
          code: "custom",
          message: "OCR line identifiers and orders must be unique",
        });
      }
      orders.add(line.order);
      ids.add(line.id);
      utf8Bytes += new TextEncoder().encode(line.text).byteLength;
      confidenceTotal += line.confidence;
      minimumConfidence = Math.min(minimumConfidence, line.confidence);
      if (
        line.polygon.some(
          (point) =>
            point.x > value.image.width || point.y > value.image.height,
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "OCR line geometry must fall inside the image",
        });
      }
    }
    const average = value.lines.length
      ? confidenceTotal / value.lines.length
      : null;
    const minimum = value.lines.length ? minimumConfidence : null;
    if (
      value.summary.lineCount !== value.lines.length ||
      value.summary.utf8Bytes !== utf8Bytes ||
      value.summary.averageConfidence !== average ||
      value.summary.minimumConfidence !== minimum
    ) {
      context.addIssue({
        code: "custom",
        message: "OCR summary must be derived exactly from its lines",
      });
    }
  });

export type OcrPurpose = z.infer<typeof ocrPurposeSchema>;
export type OcrEngineManifest = z.infer<typeof ocrEngineManifestSchema>;
export type OcrRecognitionResult = z.infer<typeof ocrRecognitionResultSchema>;
