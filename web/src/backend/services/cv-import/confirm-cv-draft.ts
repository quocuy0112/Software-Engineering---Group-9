import "server-only";

import { createHmac } from "node:crypto";

import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import { ensureCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import {
  confirmCvDraftRequestSchema,
  type ConfirmCvDraftRequest,
} from "@/shared/contracts/cv-import/review";

function logCandidateCvProjectionFailure(
  error: unknown,
  input: { accountId: string; draftId: string },
) {
  const details =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message.slice(0, 1_000),
          stack: error.stack?.slice(0, 4_000),
        }
      : { type: typeof error, message: String(error).slice(0, 1_000) };
  console.error(
    JSON.stringify({
      event: "cv_candidate_cv_projection_failed",
      operation: "cv-draft.confirm",
      ...input,
      error: details,
    }),
  );
}

export class ConfirmCvDraftService {
  constructor(
    private readonly repository = new PrismaCvConfirmationRepository(),
    private readonly secret = serverEnvironment.TOKEN_SECRET,
  ) {}

  async execute(input: {
    accountId: string;
    draftId: string;
    idempotencyKey: string;
    request: ConfirmCvDraftRequest;
  }) {
    const request = confirmCvDraftRequestSchema.parse(input.request);
    const digest = createHmac("sha256", this.secret)
      .update("smarthire:cv-confirm:idempotency:v1\0", "utf8")
      .update(input.idempotencyKey, "utf8")
      .digest();
    const result = await this.repository.confirm({
      accountId: input.accountId,
      draftId: input.draftId,
      idempotencyDigest: digest,
      draftRevision: request.draftRevision,
      sourceProfileRevision: request.sourceProfileRevision,
      reviewedProfileRevision: request.reviewedProfileRevision,
      now: new Date(),
    });
    // CandidateCv is a read projection used by Apply. Keep it outside the
    // profile confirmation transaction so a projection/legacy-data problem
    // cannot roll back an otherwise valid CV confirmation.
    try {
      await ensureCandidateCvLibrary(input.accountId);
    } catch (error) {
      logCandidateCvProjectionFailure(error, {
        accountId: input.accountId,
        draftId: input.draftId,
      });
    }
    return result;
  }
}
