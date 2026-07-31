import "server-only";
import { randomUUID } from "node:crypto";
import {
  emailChangeIdempotencyKeySchema,
  emailChangeQueuedSchema,
  emailChangeRequestSchema,
  normalizeProposedEmail,
  type EmailChangeQueued,
} from "@/shared/contracts/account/email-change";
import { EmailAddressUnavailableError } from "@/backend/repositories/account/email-address-claim-coordinator";
import {
  EmailChangeIdempotencyConflictError,
  PrismaEmailChangeRepository,
} from "@/backend/repositories/account/prisma-email-change-repository";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";
import {
  NetworkSourceProtector,
  type NetworkSourceInput,
} from "@/backend/security/network-source/network-source-protector";
import {
  RequireRecentAuthService,
  type RecentAuthResult,
} from "@/backend/services/profile/require-recent-auth";

export { EmailAddressUnavailableError, EmailChangeIdempotencyConflictError };

export class RecentAuthRequiredError extends Error {
  constructor(
    readonly status: 401 | 429,
    readonly retryAfterSeconds?: number,
  ) {
    super("RECENT_AUTH_REQUIRED");
  }
}

type RecentAuthBoundary = {
  execute(
    password: string,
    request: { headers: Headers; subject: string; now?: Date },
  ): Promise<RecentAuthResult>;
};

type Dependencies = {
  recentAuth?: RecentAuthBoundary;
  repository?: PrismaEmailChangeRepository;
  proofs?: EmailChangeProofProtector;
  network?: NetworkSourceProtector;
};

export class RequestEmailChangeService {
  private readonly recentAuth: RecentAuthBoundary;
  private readonly repository: PrismaEmailChangeRepository;
  private readonly proofs: EmailChangeProofProtector;
  private readonly network: NetworkSourceProtector;

  constructor(dependencies: Dependencies = {}) {
    this.recentAuth = dependencies.recentAuth ?? new RequireRecentAuthService();
    this.repository =
      dependencies.repository ?? new PrismaEmailChangeRepository();
    this.proofs = dependencies.proofs ?? new EmailChangeProofProtector();
    this.network = dependencies.network ?? new NetworkSourceProtector();
  }

  async execute(
    input: unknown,
    request: {
      headers: Headers;
      subject: string;
      idempotencyKey: string;
      now?: Date;
      networkSource: NetworkSourceInput;
    },
  ): Promise<EmailChangeQueued> {
    const now = request.now ?? new Date();
    const correlationId = randomUUID();
    const body = emailChangeRequestSchema.parse(input);
    const idempotencyKey = emailChangeIdempotencyKeySchema.parse(
      request.idempotencyKey,
    );
    const recent = await this.recentAuth.execute(body.currentPassword, {
      headers: request.headers,
      subject: request.subject,
      now,
    });
    const protectedNetwork = this.network.protect(request.networkSource);
    if (!recent.ok) {
      await this.repository.recordRejected({
        correlationId,
        ipPrefixDigest: protectedNetwork.ipPrefixDigest,
        reason: recent.status === 429 ? "rate_limited" : "recent_auth",
        now,
      });
      throw new RecentAuthRequiredError(
        recent.status,
        recent.retryAfterSeconds,
      );
    }

    const proposed = normalizeProposedEmail(body.newEmail);
    const proof = this.proofs.generate();
    const expiresAt = this.proofs.expiresAt(now);
    try {
      const result = await this.repository.create({
        userId: recent.userId,
        sessionId: recent.sessionId,
        proposedEmail: proposed.displayEmail,
        normalizedProposedEmail: proposed.normalizedEmail,
        tokenDigest: this.proofs.digest(proof),
        protectedProof: this.proofs.seal(proof),
        idempotencyKey,
        correlationId,
        ipPrefixDigest: protectedNetwork.ipPrefixDigest,
        now,
        expiresAt,
      });
      return emailChangeQueuedSchema.parse({
        status: "verification-queued",
        expiresAt: result.expiresAt.toISOString(),
        message:
          "Verification instructions were queued for the proposed address.",
      });
    } catch (error) {
      const reason =
        error instanceof EmailAddressUnavailableError
          ? "email_unavailable"
          : error instanceof EmailChangeIdempotencyConflictError
            ? "idempotency_conflict"
            : "mutation_failed";
      await this.repository.recordRejected({
        userId: recent.userId,
        sessionId: recent.sessionId,
        correlationId,
        ipPrefixDigest: protectedNetwork.ipPrefixDigest,
        reason,
        now,
      });
      throw error;
    }
  }
}
