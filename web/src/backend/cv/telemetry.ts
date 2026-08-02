import "server-only";

import { z } from "zod";

const opaqueCorrelationSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/u);
const safeCodeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/u);
const safeVersionSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/u);
const safeBucketSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_.+<>-]+$/u);

const cvLogEventSchema = z
  .object({
    event: z.enum([
      "cv.stage.claimed",
      "cv.stage.completed",
      "cv.stage.failed",
      "cv.lease.lost",
      "cv.cleanup.completed",
      "cv.cleanup.failed",
      "cv.readiness.failed",
    ]),
    stage: z.enum([
      "UPLOAD",
      "SCAN",
      "EXTRACTION",
      "PARSE",
      "REVIEW",
      "CONFIRM",
      "DELETE",
    ]),
    state: safeCodeSchema,
    resultCode: safeCodeSchema.optional(),
    requestId: opaqueCorrelationSchema.optional(),
    uploadId: opaqueCorrelationSchema.optional(),
    jobId: opaqueCorrelationSchema.optional(),
    workerId: opaqueCorrelationSchema.optional(),
    durationBucket: safeBucketSchema.optional(),
    queueLagBucket: safeBucketSchema.optional(),
    parserClass: z
      .enum(["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI"])
      .optional(),
    schemaVersion: safeVersionSchema.optional(),
    providerVersion: safeVersionSchema.optional(),
  })
  .strict();

const cvMetricDimensionsSchema = z
  .object({
    stage: z
      .enum([
        "UPLOAD",
        "SCAN",
        "EXTRACTION",
        "PARSE",
        "REVIEW",
        "CONFIRM",
        "DELETE",
      ])
      .optional(),
    state: safeCodeSchema.optional(),
    resultCode: safeCodeSchema.optional(),
    parserClass: z
      .enum(["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI"])
      .optional(),
    schemaVersion: safeVersionSchema.optional(),
    providerVersion: safeVersionSchema.optional(),
    durationBucket: safeBucketSchema.optional(),
    queueLagBucket: safeBucketSchema.optional(),
  })
  .strict();

const cvMetricEventSchema = z
  .object({
    metric: z.enum([
      "cv_stage_duration_ms",
      "cv_queue_lag_ms",
      "cv_stage_outcome_total",
      "cv_cleanup_lag_ms",
      "cv_cleanup_outcome_total",
      "cv_active_leases",
    ]),
    value: z.number().finite().min(0),
    dimensions: cvMetricDimensionsSchema,
  })
  .strict();

const cvTraceEventSchema = z
  .object({
    name: z.enum(["cv.stage.outcome", "cv.automatic_retry.queued"]),
    attributes: cvMetricDimensionsSchema,
  })
  .strict();

function forbidden(): never {
  throw new Error("CV_TELEMETRY_FIELD_FORBIDDEN");
}

export function buildCvLogEvent(
  input: z.input<typeof cvLogEventSchema>,
): Readonly<z.output<typeof cvLogEventSchema>> {
  const parsed = cvLogEventSchema.safeParse(input);
  if (!parsed.success) forbidden();
  return Object.freeze(parsed.data);
}

export function buildCvMetricEvent(
  input: z.input<typeof cvMetricEventSchema>,
): Readonly<z.output<typeof cvMetricEventSchema>> {
  const parsed = cvMetricEventSchema.safeParse(input);
  if (!parsed.success) forbidden();
  return Object.freeze({
    ...parsed.data,
    dimensions: Object.freeze(parsed.data.dimensions),
  });
}

export function buildCvTraceEvent(
  input: z.input<typeof cvTraceEventSchema>,
): Readonly<z.output<typeof cvTraceEventSchema>> {
  const parsed = cvTraceEventSchema.safeParse(input);
  if (!parsed.success) forbidden();
  return Object.freeze({
    ...parsed.data,
    attributes: Object.freeze(parsed.data.attributes),
  });
}

export function serializeSafeCvException(
  _error: unknown,
  fallbackCode = "CV_PROCESSING_FAILED",
): Readonly<{ code: string }> {
  const code = safeCodeSchema.safeParse(fallbackCode);
  return Object.freeze({
    code: code.success ? code.data : "CV_PROCESSING_FAILED",
  });
}
