import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { PrismaRegistrationRepository } from "@/backend/repositories/identity/prisma-registration-repository";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";
import { RequestEmailChangeService } from "@/backend/services/account/request-email-change";
import { VerifyEmailChangeService } from "@/backend/services/account/verify-email-change";

const createdUserIds = new Set<string>();
const now = new Date("2026-07-31T03:00:00.000Z");

function requestService(userId: string) {
  return new RequestEmailChangeService({
    recentAuth: {
      execute: vi.fn().mockResolvedValue({
        ok: true,
        userId,
        sessionId: `session-${userId}`,
      }),
    },
  });
}

async function request(
  userId: string,
  newEmail: string,
  idempotencyKey: string,
  at = now,
) {
  return requestService(userId).execute(
    { newEmail, currentPassword: "Current password 2026!" },
    {
      headers: new Headers(),
      subject: "concurrency",
      idempotencyKey,
      now: at,
      networkSource: { remoteAddress: "127.0.0.1" },
    },
  );
}

async function register(email: string, at: Date) {
  const suffix = randomUUID();
  const result = await new PrismaRegistrationRepository().create({
    name: "Concurrent registration",
    email,
    normalizedEmail: email.toLowerCase(),
    credentialPassword: `hash-${suffix}`,
    tokenDigest: `digest-${suffix}`,
    protectedToken: `protected-${suffix}`,
    expiresAt: new Date(at.getTime() + 24 * 60 * 60_000),
    correlationId: `registration-${suffix}`,
    now: at,
  });
  createdUserIds.add(result.userId);
  return result;
}

async function proofFor(userId: string, idempotencyKey: string) {
  const change = await prisma.emailChangeRequest.findUniqueOrThrow({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: { verificationOutbox: true },
  });
  const protectedProof = (
    change.verificationOutbox?.payloadRef as {
      protectedProof?: string;
    }
  ).protectedProof;
  if (!protectedProof) throw new Error("Missing protected proof fixture.");
  return new EmailChangeProofProtector().unseal(protectedProof);
}

afterAll(async () => {
  const ids = [...createdUserIds];
  if (!ids.length) return;
  await deleteProfileDatabaseAccounts(ids);
  await prisma.emailOutbox.deleteMany({
    where: { recipientRef: { startsWith: "registration-" } },
  });
});

describe("email claim concurrency", () => {
  it("allows only one of two account requests to reserve an equivalent email", async () => {
    const accountA = await createProfileDatabaseAccount("claim-request-a");
    const accountB = await createProfileDatabaseAccount("claim-request-b");
    createdUserIds.add(accountA.userId);
    createdUserIds.add(accountB.userId);
    const proposed = `shared-${randomUUID()}@example.test`;
    const outcomes = await Promise.allSettled([
      request(
        accountA.userId,
        proposed.toUpperCase(),
        "claim_request_key_a_00001",
      ),
      request(accountB.userId, proposed, "claim_request_key_b_00001"),
    ]);
    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.emailChangeRequest.count({
        where: { normalizedProposedEmail: proposed, status: "PENDING" },
      }),
    ).toBe(1);
  });

  it("serializes an email request against registration", async () => {
    const owner = await createProfileDatabaseAccount(
      "claim-registration-owner",
    );
    createdUserIds.add(owner.userId);
    const proposed = `request-register-${randomUUID()}@example.test`;
    const outcomes = await Promise.allSettled([
      request(owner.userId, proposed, "claim_request_register_key_01"),
      register(proposed, new Date(now.getTime() + 1_000)),
    ]);
    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const effective = await prisma.userAccount.count({
      where: { normalizedEmail: proposed },
    });
    const pending = await prisma.emailChangeRequest.count({
      where: { normalizedProposedEmail: proposed, status: "PENDING" },
    });
    expect(effective + pending).toBe(1);
  });

  it("serializes verification against a concurrent registration claim", async () => {
    const owner = await createProfileDatabaseAccount("claim-verify-owner");
    createdUserIds.add(owner.userId);
    const proposed = `verify-register-${randomUUID()}@example.test`;
    const key = "claim_verify_register_key_001";
    await request(owner.userId, proposed, key, new Date(now.getTime() + 2_000));
    const proof = await proofFor(owner.userId, key);
    const outcomes = await Promise.allSettled([
      new VerifyEmailChangeService().execute(proof, {
        now: new Date(now.getTime() + 3_000),
      }),
      register(proposed, new Date(now.getTime() + 3_000)),
    ]);
    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.userAccount.count({
        where: { normalizedEmail: proposed },
      }),
    ).toBe(1);
  });
});
