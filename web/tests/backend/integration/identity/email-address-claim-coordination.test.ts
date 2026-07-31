import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import {
  EmailAddressClaimCoordinator,
  EmailAddressUnavailableError,
} from "@/backend/repositories/account/email-address-claim-coordinator";
import { PrismaRegistrationRepository } from "@/backend/repositories/identity/prisma-registration-repository";

const runId = randomUUID();
const ownerId = `claim-owner-${runId}`;
const contestedEmail = `contested-${runId}@example.test`;

beforeAll(async () => {
  await prisma.userAccount.create({
    data: {
      id: ownerId,
      name: "Existing Candidate",
      email: `existing-${runId}@example.test`,
      normalizedEmail: `existing-${runId}@example.test`,
      state: "ACTIVE",
      candidateIdentity: {
        create: { profile: { create: {} } },
      },
    },
  });
});

afterAll(async () => {
  const users = await prisma.userAccount.findMany({
    where: {
      OR: [
        { id: ownerId },
        { normalizedEmail: contestedEmail },
        { normalizedEmail: `profile-${runId}@example.test` },
      ],
    },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.emailOutbox.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.candidateIdentity.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.userAccount.deleteMany({
    where: { id: { in: userIds } },
  });
  await prisma.$disconnect();
});

describe("normalized email claim coordination", () => {
  it("cannot accept one normalized email as both effective and pending", async () => {
    const gateway = new BetterAuthGateway();
    const token = new TokenProtector();
    const coordinator = new EmailAddressClaimCoordinator();
    const claimNow = new Date();
    const expiresAt = new Date(claimNow.getTime() + 30 * 60_000);

    const registration = new PrismaRegistrationRepository().create({
      name: "Racing Registration",
      email: contestedEmail,
      normalizedEmail: contestedEmail,
      credentialPassword:
        await gateway.preparePasswordForCredential("correct horse 2026"),
      tokenDigest: token.digest(token.generate()),
      protectedToken: token.seal(token.generate()),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      correlationId: `registration-${runId}`,
    });
    const reservation = prisma.$transaction(async (tx) => {
      await coordinator.assertAvailable(tx, {
        normalizedEmail: contestedEmail,
        claimantUserId: ownerId,
        now: claimNow,
      });
      return tx.emailChangeRequest.create({
        data: {
          userId: ownerId,
          proposedEmail: contestedEmail,
          normalizedProposedEmail: contestedEmail,
          tokenDigest: `claim-digest-${runId}`,
          createdAt: claimNow,
          expiresAt,
          idempotencyKey: `claim-request-${runId}`,
          correlationId: `claim-correlation-${runId}`,
          createdBySessionId: `claim-session-${runId}`,
        },
      });
    });

    const outcomes = await Promise.allSettled([registration, reservation]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(EmailAddressUnavailableError);
    const effective = await prisma.userAccount.count({
      where: { normalizedEmail: contestedEmail },
    });
    const pending = await prisma.emailChangeRequest.count({
      where: {
        normalizedProposedEmail: contestedEmail,
        status: "PENDING",
      },
    });
    expect(effective + pending).toBe(1);
  });

  it("registration creates exactly one canonical empty profile", async () => {
    const email = `profile-${runId}@example.test`;
    const gateway = new BetterAuthGateway();
    const token = new TokenProtector();
    await new PrismaRegistrationRepository().create({
      name: "Profile Registration",
      email,
      normalizedEmail: email,
      credentialPassword:
        await gateway.preparePasswordForCredential("correct horse 2026"),
      tokenDigest: token.digest(token.generate()),
      protectedToken: token.seal(token.generate()),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      correlationId: `profile-registration-${runId}`,
    });
    const user = await prisma.userAccount.findUniqueOrThrow({
      where: { normalizedEmail: email },
      include: {
        candidateIdentity: { include: { profile: true } },
      },
    });
    expect(user.candidateIdentity?.profile).toMatchObject({
      headline: null,
      summary: null,
      phone: null,
      location: null,
      revision: 0,
    });
    expect(
      await prisma.candidateProfile.count({
        where: { candidateUserId: user.id },
      }),
    ).toBe(1);
  });
});
