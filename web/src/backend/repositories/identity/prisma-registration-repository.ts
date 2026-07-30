import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

export type RegistrationPersistenceInput = {
  name: string;
  email: string;
  normalizedEmail: string;
  credentialPassword: string;
  tokenDigest: string;
  protectedToken: string;
  expiresAt: Date;
  correlationId: string;
};

export class DuplicateRegistrationError extends Error {}

export class PrismaRegistrationRepository {
  async create(
    input: RegistrationPersistenceInput,
  ): Promise<{ userId: string; outboxId: string }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const userId = randomUUID();
          await tx.userAccount.create({
            data: {
              id: userId,
              name: input.name,
              email: input.email,
              normalizedEmail: input.normalizedEmail,
              emailVerified: false,
              state: "PENDING_VERIFICATION",
            },
          });
          await tx.authProviderAccount.create({
            data: {
              id: randomUUID(),
              providerId: "credential",
              accountId: userId,
              userId,
              password: input.credentialPassword,
            },
          });
          await tx.candidateIdentity.create({ data: { userId } });
          const token = await tx.securityToken.create({
            data: {
              userId,
              purpose: "VERIFY_EMAIL",
              status: "ACTIVE",
              tokenDigest: input.tokenDigest,
              expiresAt: input.expiresAt,
              createdByRequestId: input.correlationId,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorType: "anonymous",
              action: "registration.accepted",
              targetType: "user_account",
              targetId: userId,
              result: "SUCCESS",
              correlationId: input.correlationId,
              context: { state: "PENDING_VERIFICATION" },
            },
          });
          const outbox = await tx.emailOutbox.create({
            data: {
              kind: "VERIFY_EMAIL",
              userId,
              securityTokenId: token.id,
              recipientRef: userId,
              templateVersion: "verify-email.v1",
              payloadRef: { protectedToken: input.protectedToken },
              idempotencyKey: `verification:${token.id}`,
            },
          });
          return { userId, outboxId: outbox.id };
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new DuplicateRegistrationError();
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new Error("REGISTRATION_TRANSACTION_RETRY_EXHAUSTED");
  }
}
