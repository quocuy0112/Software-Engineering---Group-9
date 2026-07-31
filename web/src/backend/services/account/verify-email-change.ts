import "server-only";
import {
  emailChangeProofSchema,
  emailChangeVerificationOutcomeSchema,
  type EmailChangeVerificationOutcome,
} from "@/shared/contracts/account/email-change";
import { PrismaEmailChangeRepository } from "@/backend/repositories/account/prisma-email-change-repository";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";

export class EmailChangeProofInvalidError extends Error {
  constructor() {
    super("EMAIL_CHANGE_PROOF_INVALID");
  }
}

export class EmailChangeVerificationUnavailableError extends Error {
  constructor() {
    super("EMAIL_ADDRESS_UNAVAILABLE");
  }
}

export class VerifyEmailChangeService {
  constructor(
    private readonly repository = new PrismaEmailChangeRepository(),
    private readonly proofs = new EmailChangeProofProtector(),
  ) {}

  async execute(
    proofInput: unknown,
    request: {
      now?: Date;
      unrelatedSessionUserId?: string;
    } = {},
  ): Promise<EmailChangeVerificationOutcome> {
    void request.unrelatedSessionUserId;
    const now = request.now ?? new Date();
    const parsed =
      typeof proofInput === "string"
        ? emailChangeProofSchema.safeParse({ proof: proofInput })
        : emailChangeProofSchema.safeParse(proofInput);
    if (!parsed.success) {
      await this.repository
        .recordVerificationRejected(now)
        .catch(() => undefined);
      throw new EmailChangeProofInvalidError();
    }
    let digest: string;
    try {
      digest = this.proofs.digest(parsed.data.proof);
    } catch {
      await this.repository
        .recordVerificationRejected(now)
        .catch(() => undefined);
      throw new EmailChangeProofInvalidError();
    }
    const outcome = await this.repository.verify(digest, now);
    if (outcome.status === "invalid") {
      throw new EmailChangeProofInvalidError();
    }
    if (outcome.status === "unavailable") {
      throw new EmailChangeVerificationUnavailableError();
    }
    return emailChangeVerificationOutcomeSchema.parse({
      status: "success",
      message: "Your verified email address has been changed.",
    });
  }
}
