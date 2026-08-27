import "server-only";

import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { imageSearchStatusResponseSchema } from "@/shared/contracts/jobs/image-search";
import { ImageSearchServiceError } from "./image-search-errors";

const TERMINAL = new Set([
  "VALIDATION_FAILED",
  "INFECTED",
  "SCAN_FAILED",
  "DECODE_FAILED",
  "OCR_FAILED",
  "INTERPRET_FAILED",
  "CONSUMED",
  "CANCELLED",
  "EXPIRED",
  "DELETED",
]);

function stage(status: string) {
  if (status === "AWAITING_CONTENT") return "UPLOAD" as const;
  if (["SCAN_QUEUED", "SCANNING"].includes(status)) return "SCAN" as const;
  if (["DECODE_QUEUED", "DECODING"].includes(status)) return "DECODE" as const;
  if (["OCR_QUEUED", "OCR_PROCESSING"].includes(status)) return "OCR" as const;
  if (status === "AWAITING_CONSENT") return "CONSENT" as const;
  if (["INTERPRET_QUEUED", "INTERPRETING"].includes(status))
    return "INTERPRET" as const;
  if (["RESULT_READY", "FALLBACK_READY"].includes(status))
    return "RESULT" as const;
  return "TERMINAL" as const;
}

function failureCode(value: string | null) {
  const allowed = new Set([
    "VALIDATION_FAILED",
    "MALWARE_DETECTED",
    "SCANNER_UNAVAILABLE",
    "SCANNER_DEFINITIONS_STALE",
    "UNSUPPORTED_IMAGE",
    "IMAGE_LIMIT_EXCEEDED",
    "IMAGE_DECODE_FAILED",
    "OCR_UNAVAILABLE",
    "OCR_NO_TEXT",
    "OCR_LOW_CONFIDENCE",
    "OCR_PARTIAL",
    "OCR_DEADLINE_EXCEEDED",
    "OCR_OUTPUT_TOO_LARGE",
    "CONSENT_REQUIRED",
    "INTERPRETER_UNAVAILABLE",
    "INTERPRETER_INVALID_OUTPUT",
    "QUERY_EXPIRED",
  ]);
  return value && allowed.has(value) ? value : null;
}

export class GetImageSearchStatusService {
  constructor(
    private readonly dependencies: Readonly<{
      repository: PrismaImageSearchQueryRepository;
      capabilityHmacKey: Uint8Array;
      now(): Date;
    }>,
  ) {}

  async execute(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
  }) {
    const query = await this.dependencies.repository
      .authorize({
        ...input,
        capabilityHmacKey: this.dependencies.capabilityHmacKey,
        now: this.dependencies.now(),
        allowInaccessible: true,
      })
      .catch(() => {
        throw new ImageSearchServiceError(
          404,
          "IMAGE_SEARCH_NOT_FOUND",
          "Image search was not found.",
        );
      });
    const row = await this.dependencies.repository.currentStatus(query.id);
    if (!row)
      throw new ImageSearchServiceError(
        404,
        "IMAGE_SEARCH_NOT_FOUND",
        "Image search was not found.",
      );
    const latestConsent = row.consentEvents[0]?.action;
    const actions: string[] = [];
    if (row.status === "AWAITING_CONTENT") actions.push("UPLOAD_CONTENT");
    if (row.status === "AWAITING_CONSENT") actions.push("GRANT_CONSENT");
    if (latestConsent === "GRANTED" && !TERMINAL.has(row.status))
      actions.push("REVOKE_CONSENT");
    if (["RESULT_READY", "FALLBACK_READY"].includes(row.status))
      actions.push("CONSUME_RESULT");
    if (!TERMINAL.has(row.status)) actions.push("CANCEL");
    return imageSearchStatusResponseSchema.parse({
      queryId: row.id,
      state: row.status,
      stage: stage(row.status),
      availableActions: actions,
      admittedAt: row.admittedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      retryAt: null,
      failureCode: failureCode(row.failureCode),
    });
  }
}
