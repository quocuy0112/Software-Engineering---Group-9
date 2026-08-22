import "server-only";

import type { CvFileValidationCode } from "@/shared/cv-file-validation";

export type CvUploadRejectionReason =
  | CvFileValidationCode
  | "CONTENT_LENGTH_MISMATCH"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CONTENT_UNREADABLE"
  | "EXTRACTION_EMPTY"
  | "CV_TEXT_UNAVAILABLE"
  | "CV_TEXT_TOO_SHORT"
  | "CV_TEXT_INVALID"
  | "CV_NOT_RECOGNIZED"
  | "CV_NOT_RECOGNIZED_AS_CV"
  | "CV_CLASSIFICATION_TIMEOUT"
  | "CV_CLASSIFICATION_UNAVAILABLE"
  | "CV_CLASSIFICATION_MALFORMED"
  | "CV_CLASSIFICATION_NOT_CONFIGURED";

export type CvScoringFailureReason =
  | "CV_TEXT_UNAVAILABLE"
  | "CV_TEXT_TOO_SHORT"
  | "CV_TEXT_INVALID"
  | "CV_NOT_RECOGNIZED_AS_CV"
  | "CV_CLASSIFICATION_TIMEOUT"
  | "CV_CLASSIFICATION_UNAVAILABLE"
  | "CV_CLASSIFICATION_MALFORMED"
  | "SCORING_TIMEOUT"
  | "SCORING_RETRY_LIMIT_REACHED"
  | "SCORING_WORK_FAILED";

const FAILURE_ALERT_WINDOW_MS = 5 * 60_000;
const DEFAULT_FAILURE_ALERT_THRESHOLD = 5;
const DEFAULT_TIMEOUT_ALERT_THRESHOLD = 3;

const recentScoringFailures: Array<{
  at: number;
  reason: string;
}> = [];
let lastScoringAlertAt = 0;

function positiveIntegerEnv(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function emitScoringSpikeAlert(input: {
  now: number;
  failureCount: number;
  timeoutCount: number;
}): void {
  const event = {
    event: "cv_scoring_failure_spike",
    failureCount: input.failureCount,
    timeoutCount: input.timeoutCount,
    windowMilliseconds: FAILURE_ALERT_WINDOW_MS,
  };
  console.error(JSON.stringify(event));

  const webhook = process.env.CV_OPS_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const url = new URL(webhook);
    if (url.protocol !== "https:") return;
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-smarthire-idempotency-key": `cv-scoring-spike:${Math.floor(input.now / FAILURE_ALERT_WINDOW_MS)}`,
      },
      body: JSON.stringify(event),
    }).catch(() => undefined);
  } catch {
    // A malformed alert destination must never affect scoring state.
  }
}

/**
 * Upload diagnostics intentionally omit filenames, raw MIME payloads, CV
 * text, and idempotency keys. The event is still structured enough for log
 * aggregation and alerting on rejection spikes.
 */
export function logCvUploadRejection(input: {
  reason: CvUploadRejectionReason;
  byteSize?: number;
  declaredMimeType?: string;
  uploadId?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "cv_upload_rejected",
      reason: input.reason,
      ...(Number.isSafeInteger(input.byteSize)
        ? { byteSize: input.byteSize }
        : {}),
      ...(input.declaredMimeType
        ? { declaredMimeType: input.declaredMimeType.slice(0, 80) }
        : {}),
      ...(input.uploadId ? { uploadId: input.uploadId.slice(0, 80) } : {}),
    }),
  );
}

/**
 * Classification telemetry contains only the decision metadata needed to
 * tune the threshold and compare outcomes over time. It never includes CV
 * text, model prompts, filenames, or the model's free-form reason.
 */
export function logCvClassificationOutcome(input: {
  isCv: boolean;
  confidence: number;
  accepted: boolean;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  decisionBasis?: string;
  structuralConfidence?: number;
}): void {
  console.info(
    JSON.stringify({
      event: "cv_classification_completed",
      isCv: input.isCv,
      accepted: input.accepted,
      confidence: Math.round(input.confidence * 100),
      source: input.source,
      ...(input.decisionBasis
        ? { decisionBasis: input.decisionBasis.slice(0, 80) }
        : {}),
      ...(typeof input.structuralConfidence === "number"
        ? {
            structuralConfidence: Math.round(input.structuralConfidence * 100),
          }
        : {}),
    }),
  );
}

function safeProviderToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[^a-zA-Z0-9._/-]/gu, "_").slice(0, 80);
  return normalized || undefined;
}

/**
 * Provider diagnostics deliberately keep only status/code/parameter metadata.
 * The response body, request prompt, API key, and extracted CV text must never
 * be written to logs.
 */
export function logCvClassificationProviderFailure(input: {
  reason: string;
  model: string;
  status?: number;
  providerCode?: string;
  providerParam?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "cv_classification_provider_failed",
      reason: input.reason.slice(0, 120),
      model: safeProviderToken(input.model),
      ...(Number.isInteger(input.status) ? { status: input.status } : {}),
      ...(safeProviderToken(input.providerCode)
        ? { providerCode: safeProviderToken(input.providerCode) }
        : {}),
      ...(safeProviderToken(input.providerParam)
        ? { providerParam: safeProviderToken(input.providerParam) }
        : {}),
    }),
  );
}

export function logCvScoringFailure(input: {
  reason: CvScoringFailureReason | string;
  workItemId?: string;
}): void {
  const now = Date.now();
  const reason = input.reason.slice(0, 120);
  recentScoringFailures.push({ at: now, reason });
  while (
    recentScoringFailures[0] &&
    recentScoringFailures[0].at < now - FAILURE_ALERT_WINDOW_MS
  ) {
    recentScoringFailures.shift();
  }

  console.warn(
    JSON.stringify({
      event: "cv_scoring_failed",
      reason,
      ...(input.workItemId
        ? { workItemId: input.workItemId.slice(0, 80) }
        : {}),
    }),
  );

  const timeoutCount = recentScoringFailures.filter(
    (failure) => failure.reason === "SCORING_TIMEOUT",
  ).length;
  const failureThreshold = positiveIntegerEnv(
    "CV_SCORING_ALERT_THRESHOLD",
    DEFAULT_FAILURE_ALERT_THRESHOLD,
    100,
  );
  const timeoutThreshold = positiveIntegerEnv(
    "CV_SCORING_TIMEOUT_ALERT_THRESHOLD",
    DEFAULT_TIMEOUT_ALERT_THRESHOLD,
    100,
  );
  const shouldAlert =
    recentScoringFailures.length >= failureThreshold ||
    timeoutCount >= timeoutThreshold;
  if (shouldAlert && now - lastScoringAlertAt >= FAILURE_ALERT_WINDOW_MS) {
    lastScoringAlertAt = now;
    emitScoringSpikeAlert({
      now,
      failureCount: recentScoringFailures.length,
      timeoutCount,
    });
  }
}
