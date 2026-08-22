import "server-only";

import type { PrivateMatchErrorCode } from "@/shared/contracts/private-cv-match";

export class PrivateCvMatchError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    readonly code: PrivateMatchErrorCode,
  ) {
    super(code);
    this.name = "PrivateCvMatchError";
  }
}

export function privateMatchError(
  code: PrivateMatchErrorCode,
  status: PrivateCvMatchError["status"] = code === "UNAVAILABLE"
    ? 404
    : code === "AUTH_REQUIRED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "CONFLICT"
          ? 409
          : code === "INTERNAL_FAILURE"
            ? 503
            : 400,
): PrivateCvMatchError {
  return new PrivateCvMatchError(status, code);
}

export function safePrivateFailureCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "INTERNAL_FAILURE";
  const safeCodes = new Set([
    "CV_ARTIFACT_UNAVAILABLE",
    "CV_DIGEST_MISMATCH",
    "CV_FORMAT_UNSUPPORTED",
    "CV_LENGTH_MISMATCH",
    "CV_SOURCE_UNAVAILABLE",
    "CV_STORAGE_CONFIGURATION_INVALID",
    "CV_STORAGE_LENGTH_MISMATCH",
    "CV_STORAGE_LOCATOR_INVALID",
    "CV_STORAGE_NOT_READY",
    "CV_STORAGE_OBJECT_NOT_FOUND",
    "CV_STORAGE_OBJECT_EXISTS",
    "CV_STORAGE_OPERATION_FAILED",
    "CV_TEXT_UNAVAILABLE",
    "SCORING_CV_TEXT_UNAVAILABLE",
    "CV_TEXT_TOO_SHORT",
    "CV_TEXT_INVALID",
    "CV_NOT_RECOGNIZED_AS_CV",
    "CV_CLASSIFICATION_TIMEOUT",
    "CV_CLASSIFICATION_UNAVAILABLE",
    "CV_CLASSIFICATION_MALFORMED",
    "CV_CLASSIFICATION_NOT_CONFIGURED",
    "SCORING_TIMEOUT",
    "INCOMPATIBLE_SCORE_LINEAGE",
    "PRIVATE_ATTEMPT_LEASE_LOST",
    "PRIVATE_ATTEMPT_PUBLISH_BLOCKED",
    "PRIVATE_CHECK_UNAVAILABLE",
    "PRIVATE_DETERMINISTIC_RESULT_UNAVAILABLE",
    "PRIVATE_RETRY_NOT_ALLOWED",
    "AI_PROVIDER_TIMEOUT",
    "AI_PROVIDER_UNAVAILABLE",
    "AI_PROVIDER_NOT_CONFIGURED",
    "AI_PROVIDER_AUTHENTICATION",
    "AI_PROVIDER_INVALID_REQUEST",
    "AI_PROVIDER_MODEL_NOT_FOUND",
    "AI_PROVIDER_RATE_LIMITED",
    "AI_PROVIDER_POLICY_NOT_APPROVED",
    "AI_PROVIDER_MALFORMED",
    "AI_PROVIDER_CIRCUIT_OPEN",
    "AI_PROVIDER_RETRY_EXHAUSTED",
  ]);
  if (safeCodes.has(code)) return code;
  return "INTERNAL_FAILURE";
}
