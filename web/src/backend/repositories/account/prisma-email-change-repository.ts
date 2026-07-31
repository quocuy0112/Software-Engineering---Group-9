import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import {
  EmailAddressClaimCoordinator,
  EmailAddressUnavailableError,
} from "@/backend/repositories/account/email-address-claim-coordinator";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";

export class EmailChangeIdempotencyConflictError extends Error {
  constructor() {
    super("EMAIL_CHANGE_IDEMPOTENCY_CONFLICT");
  }
}

export type CreateEmailChangeInput = {
  userId: string;
  sessionId: string;
  proposedEmail: string;
  normalizedProposedEmail: string;
  tokenDigest: string;
  protectedProof: string;
  idempotencyKey: string;
  correlationId: string;
  ipPrefixDigest: string;
  now: Date;
  expiresAt: Date;
};

export type CreateEmailChangeResult = {
  requestId: string;
  expiresAt: Date;
  replayed: boolean;
};

export type VerifyEmailChangeResult =
  | { status: "verified"; userId: string }
  | { status: "invalid"; userId?: string }
  | { status: "unavailable"; userId: string };

export class PrismaEmailChangeRepository {
  constructor(
    private readonly claims = new EmailAddressClaimCoordinator(),
    private readonly recipients = new ProtectedOutboxRecipient(),
  ) {}

  async create(
    input: CreateEmailChangeInput,
  ): Promise<CreateEmailChangeResult> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "user"
        WHERE "id" = ${input.userId}
          AND "state" = 'ACTIVE'
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new Error("ACCOUNT_IDENTITY_UNAVAILABLE");
      }
      const account = await tx.userAccount.findUniqueOrThrow({
        where: { id: input.userId },
        select: { email: true },
      });
      const existing = await tx.emailChangeRequest.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: {
          id: true,
          normalizedProposedEmail: true,
          expiresAt: true,
        },
      });
      if (existing) {
        if (
          existing.normalizedProposedEmail !== input.normalizedProposedEmail
        ) {
          throw new EmailChangeIdempotencyConflictError();
        }
        return {
          requestId: existing.id,
          expiresAt: existing.expiresAt,
          replayed: true,
        };
      }

      await tx.emailChangeRequest.updateMany({
        where: {
          userId: input.userId,
          status: "PENDING",
          expiresAt: { lte: input.now },
        },
        data: { status: "EXPIRED", resolvedAt: input.now },
      });
      const previous = await tx.emailChangeRequest.findFirst({
        where: { userId: input.userId, status: "PENDING" },
        select: { id: true },
      });
      if (previous) {
        await tx.emailChangeRequest.update({
          where: { id: previous.id },
          data: {
            status: "SUPERSEDED",
            supersededAt: input.now,
            resolvedAt: input.now,
          },
        });
        await new PrismaAuditRepository(tx).append({
          occurredAt: input.now,
          actorType: "user",
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "email_change.superseded",
          targetType: "email_change",
          targetId: previous.id,
          result: "SUCCESS",
          correlationId: input.correlationId,
          ipPrefixDigest: input.ipPrefixDigest,
          context: { status: "superseded" },
        });
      }

      await this.claims.assertAvailable(tx, {
        normalizedEmail: input.normalizedProposedEmail,
        claimantUserId: input.userId,
        now: input.now,
      });

      const requestId = randomUUID();
      await tx.emailChangeRequest.create({
        data: {
          id: requestId,
          userId: input.userId,
          proposedEmail: input.proposedEmail,
          normalizedProposedEmail: input.normalizedProposedEmail,
          tokenDigest: input.tokenDigest,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          createdBySessionId: input.sessionId,
          createdAt: input.now,
        },
      });

      const verificationOutbox = await tx.emailOutbox.create({
        data: {
          kind: "EMAIL_CHANGE_VERIFY",
          userId: input.userId,
          recipientRef: requestId,
          recipientCiphertext: this.recipients.seal(
            input.proposedEmail,
            "email-change-verification.v1",
          ),
          recipientPurpose: "email-change-verification.v1",
          templateVersion: "email-change-verification.v1",
          payloadRef: { protectedProof: input.protectedProof },
          idempotencyKey: `email-change:${requestId}:verification`,
          nextAttemptAt: input.now,
        },
      });
      const oldAddressOutbox = await tx.emailOutbox.create({
        data: {
          kind: "SECURITY_ALERT",
          userId: input.userId,
          recipientRef: requestId,
          recipientCiphertext: this.recipients.seal(
            account.email,
            "email-change-old-address.v1",
          ),
          recipientPurpose: "email-change-old-address.v1",
          templateVersion: "email-change-alert.v1",
          payloadRef: { event: "email-change-requested" },
          idempotencyKey: `email-change:${requestId}:old-address`,
          nextAttemptAt: input.now,
        },
      });
      await tx.emailChangeRequest.update({
        where: { id: requestId },
        data: {
          verificationOutboxId: verificationOutbox.id,
          oldEmailNoticeOutboxId: oldAddressOutbox.id,
        },
      });
      await new PrismaAuditRepository(tx).append({
        occurredAt: input.now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "email_change.requested",
        targetType: "email_change",
        targetId: requestId,
        result: "SUCCESS",
        correlationId: input.correlationId,
        ipPrefixDigest: input.ipPrefixDigest,
        context: { status: "verification_queued" },
      });
      return {
        requestId,
        expiresAt: input.expiresAt,
        replayed: false,
      };
    });
  }

  async recordRejected(input: {
    userId?: string;
    sessionId?: string;
    correlationId: string;
    ipPrefixDigest?: string;
    reason: string;
    now: Date;
  }): Promise<void> {
    await new PrismaAuditRepository()
      .append({
        occurredAt: input.now,
        actorType: input.userId ? "user" : "anonymous",
        actorUserId: input.userId ?? null,
        actorSessionId: input.sessionId ?? null,
        action: "email_change.rejected",
        targetType: "email_change",
        targetId: null,
        result: "DENIED",
        correlationId: input.correlationId,
        ipPrefixDigest: input.ipPrefixDigest ?? null,
        context: { reason: input.reason },
      })
      .catch(() => undefined);
  }

  async verify(
    tokenDigest: string,
    now: Date,
  ): Promise<VerifyEmailChangeResult> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "EmailChangeRequest"
        WHERE "tokenDigest" = ${tokenDigest}
        FOR UPDATE
      `;
      const requestId = rows[0]?.id;
      if (!requestId) {
        await new PrismaAuditRepository(tx).append({
          occurredAt: now,
          actorType: "anonymous",
          actorUserId: null,
          actorSessionId: null,
          action: "email_change.verification_failed",
          targetType: "email_change",
          targetId: null,
          result: "DENIED",
          correlationId: randomUUID(),
          context: { reason: "proof_unusable" },
        });
        return { status: "invalid" };
      }
      const request = await tx.emailChangeRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      const audit = new PrismaAuditRepository(tx);
      const failed = async (reason: string) => {
        await audit.append({
          occurredAt: now,
          actorType: "user",
          actorUserId: request.userId,
          actorSessionId: request.createdBySessionId,
          action: "email_change.verification_failed",
          targetType: "email_change",
          targetId: request.id,
          result: "DENIED",
          correlationId: request.correlationId,
          context: { reason },
        });
      };

      if (request.status !== "PENDING") {
        await failed("proof_unusable");
        return { status: "invalid", userId: request.userId };
      }
      if (request.expiresAt.getTime() <= now.getTime()) {
        await tx.emailChangeRequest.update({
          where: { id: request.id },
          data: { status: "EXPIRED", resolvedAt: now },
        });
        await failed("expired");
        return { status: "invalid", userId: request.userId };
      }

      const accountRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "user"
        WHERE "id" = ${request.userId}
          AND "state" = 'ACTIVE'
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (accountRows.length !== 1) {
        await failed("account_unavailable");
        return { status: "invalid", userId: request.userId };
      }

      try {
        await this.claims.assertAvailable(tx, {
          normalizedEmail: request.normalizedProposedEmail,
          claimantUserId: request.userId,
          reservationRequestId: request.id,
          now,
        });
      } catch (error) {
        if (!(error instanceof EmailAddressUnavailableError)) throw error;
        await tx.emailChangeRequest.update({
          where: { id: request.id },
          data: { status: "CONFLICTED", resolvedAt: now },
        });
        await failed("email_unavailable");
        return { status: "unavailable", userId: request.userId };
      }

      const accountChanged = await tx.userAccount.updateMany({
        where: {
          id: request.userId,
          state: "ACTIVE",
          deletedAt: null,
        },
        data: {
          email: request.proposedEmail,
          normalizedEmail: request.normalizedProposedEmail,
          emailVerified: true,
        },
      });
      const requestChanged = await tx.emailChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING", consumedAt: null },
        data: {
          status: "CONSUMED",
          consumedAt: now,
          resolvedAt: now,
        },
      });
      if (accountChanged.count !== 1 || requestChanged.count !== 1) {
        throw new Error("EMAIL_CHANGE_VERIFICATION_ATOMICITY_FAILED");
      }
      await audit.append({
        occurredAt: now,
        actorType: "user",
        actorUserId: request.userId,
        actorSessionId: request.createdBySessionId,
        action: "email_change.verified",
        targetType: "email_change",
        targetId: request.id,
        result: "SUCCESS",
        correlationId: request.correlationId,
        context: { status: "verified" },
      });
      return { status: "verified", userId: request.userId };
    });
  }

  async recordVerificationRejected(
    now: Date,
    reason = "proof_malformed",
  ): Promise<void> {
    await new PrismaAuditRepository().append({
      occurredAt: now,
      actorType: "anonymous",
      actorUserId: null,
      actorSessionId: null,
      action: "email_change.verification_failed",
      targetType: "email_change",
      targetId: null,
      result: "DENIED",
      correlationId: randomUUID(),
      context: { reason },
    });
  }
}
