import "server-only";

import { randomUUID } from "node:crypto";

import { CvRequestBoundaryError } from "@/backend/security/cv-account-request-boundary";
import { cvJsonResponse } from "@/backend/security/cv-account-request-boundary";
import {
  cvApiErrorSchema,
  type CvApiError,
} from "@/shared/contracts/cv-import/common";

export type CvServiceFailureCode = CvApiError["error"]["code"];

type CvFailureOptions = Readonly<{
  fieldErrors?: CvApiError["error"]["fieldErrors"];
  latest?: CvApiError["error"]["latest"];
  retryAfterSeconds?: number;
}>;

export class CvImportServiceError extends Error {
  readonly name = "CvImportServiceError";
  readonly fieldErrors: CvApiError["error"]["fieldErrors"];
  readonly latest: CvApiError["error"]["latest"];
  readonly retryAfterSeconds: number | null;

  constructor(
    readonly code: CvServiceFailureCode,
    options: CvFailureOptions = {},
  ) {
    super(code);
    this.fieldErrors = (options.fieldErrors ?? [])
      .slice(0, 100)
      .map((item) => ({
        path: item.path.slice(0, 200),
        code: item.code.slice(0, 100),
        message: item.message.slice(0, 300),
      }));
    this.latest = options.latest ?? null;
    this.retryAfterSeconds =
      options.retryAfterSeconds &&
      Number.isSafeInteger(options.retryAfterSeconds) &&
      options.retryAfterSeconds > 0
        ? Math.min(options.retryAfterSeconds, 86_400)
        : null;
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

const errorPresentation: Record<
  CvServiceFailureCode,
  Readonly<{ status: number; message: string }>
> = {
  VALIDATION_ERROR: {
    status: 400,
    message: "Review the highlighted fields.",
  },
  AUTHENTICATION_REQUIRED: { status: 401, message: "Sign in to continue." },
  FORBIDDEN: { status: 403, message: "This action is not available." },
  CSRF_REJECTED: {
    status: 403,
    message: "Refresh the page and try again.",
  },
  CV_IMPORT_NOT_FOUND: { status: 404, message: "CV import not found." },
  CV_DRAFT_NOT_FOUND: { status: 404, message: "CV draft not found." },
  IDEMPOTENCY_KEY_REUSED: {
    status: 409,
    message: "That request key was already used for a different operation.",
  },
  DRAFT_REVISION_CONFLICT: {
    status: 409,
    message: "The CV draft changed. Refresh it before continuing.",
  },
  PROFILE_REVISION_CONFLICT: {
    status: 409,
    message: "The candidate profile changed. Review the latest profile.",
  },
  IMPORT_STATE_CONFLICT: {
    status: 409,
    message: "The CV import is no longer in the required state.",
  },
  PAYLOAD_TOO_LARGE: { status: 413, message: "The request is too large." },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Only the reserved PDF or DOCX media type is accepted.",
  },
  DOCUMENT_REJECTED: {
    status: 422,
    message: "The document could not be accepted for CV processing.",
  },
  UPLOAD_RATE_LIMITED: {
    status: 429,
    message: "The upload attempt limit has been reached.",
  },
  CV_QUOTA_EXCEEDED: {
    status: 429,
    message: "The CV storage or import limit has been reached.",
  },
  RETRY_LIMIT_REACHED: {
    status: 429,
    message: "No additional retry is available for this stage.",
  },
  CONSENT_REQUIRED: {
    status: 409,
    message: "Consent is required before external processing can begin.",
  },
  CV_PROCESSING_UNAVAILABLE: {
    status: 503,
    message: "CV processing is temporarily unavailable.",
  },
};

export type CvHttpError = Readonly<{
  status: number;
  body: CvApiError;
  retryAfterSeconds: number | null;
}>;

function normalizeRequestId(requestId: string): string {
  return requestId.length >= 1 && requestId.length <= 100
    ? requestId
    : randomUUID();
}

export function mapCvHttpError(
  error: unknown,
  requestId: string = randomUUID(),
): CvHttpError {
  const safeRequestId = normalizeRequestId(requestId);
  const failure =
    error instanceof CvImportServiceError
      ? error
      : error instanceof CvRequestBoundaryError
        ? new CvImportServiceError(error.code, {
            fieldErrors: error.fieldErrors,
          })
        : new CvImportServiceError("CV_PROCESSING_UNAVAILABLE");
  const presentation = errorPresentation[failure.code];
  const body = cvApiErrorSchema.parse({
    error: {
      code: failure.code,
      message: presentation.message,
      requestId: safeRequestId,
      fieldErrors: failure.fieldErrors,
      latest: failure.latest,
    },
  });
  return {
    status: presentation.status,
    body,
    retryAfterSeconds: failure.retryAfterSeconds,
  };
}

export function cvHttpErrorResponse(
  error: unknown,
  requestId: string = randomUUID(),
): Response {
  const mapped = mapCvHttpError(error, requestId);
  return cvJsonResponse(mapped.body, {
    status: mapped.status,
    headers: mapped.retryAfterSeconds
      ? { "Retry-After": String(mapped.retryAfterSeconds) }
      : undefined,
  });
}

export const CV_TOMBSTONE_STATES = ["CANCELLED", "DELETED", "EXPIRED"] as const;

export function cvContentFreeTombstone(input: {
  uploadId: string;
  status: (typeof CV_TOMBSTONE_STATES)[number];
  contentInaccessibleAt?: Date | string;
  deleteAfter?: Date | string;
  deletedAt?: Date | string | null;
}) {
  const lifecycle =
    input.contentInaccessibleAt && input.deleteAfter
      ? {
          contentInaccessibleAt:
            input.contentInaccessibleAt instanceof Date
              ? input.contentInaccessibleAt.toISOString()
              : input.contentInaccessibleAt,
          deleteAfter:
            input.deleteAfter instanceof Date
              ? input.deleteAfter.toISOString()
              : input.deleteAfter,
          deletedAt:
            input.deletedAt instanceof Date
              ? input.deletedAt.toISOString()
              : (input.deletedAt ?? null),
        }
      : {};
  return Object.freeze({
    uploadId: input.uploadId,
    status: input.status,
    ...lifecycle,
  });
}
