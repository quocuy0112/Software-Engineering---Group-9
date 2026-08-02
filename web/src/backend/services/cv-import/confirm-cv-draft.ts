import "server-only";

import { createHmac } from "node:crypto";

import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import {
  confirmCvDraftRequestSchema,
  type ConfirmCvDraftRequest,
} from "@/shared/contracts/cv-import/review";

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
    return this.repository.confirm({
      accountId: input.accountId,
      draftId: input.draftId,
      idempotencyDigest: digest,
      draftRevision: request.draftRevision,
      sourceProfileRevision: request.sourceProfileRevision,
      reviewedProfileRevision: request.reviewedProfileRevision,
      now: new Date(),
    });
  }
}
