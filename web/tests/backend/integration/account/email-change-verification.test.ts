import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";
import { RequestEmailChangeService } from "@/backend/services/account/request-email-change";
import { VerifyEmailChangeService } from "@/backend/services/account/verify-email-change";

const userIds = new Set<string>();
const baseTime = new Date("2026-07-31T04:00:00.000Z");
let sequence = 0;

function serviceFor(userId: string) {
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

async function pending(
  label: string,
  at = baseTime,
): Promise<{
  account: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
  proposed: string;
  proof: string;
  requestId: string;
}> {
  sequence += 1;
  const account = await createProfileDatabaseAccount(
    `verify-${label}-${sequence}`,
  );
  userIds.add(account.userId);
  const proposed = `verify-${label}-${sequence}-${randomUUID()}@example.test`;
  const key = `verification_${label}_${sequence}_key_0001`.replace(
    /[^A-Za-z0-9_-]/g,
    "_",
  );
  await serviceFor(account.userId).execute(
    { newEmail: proposed, currentPassword: "Current password 2026!" },
    {
      headers: new Headers(),
      subject: "verification",
      idempotencyKey: key,
      now: at,
      networkSource: { remoteAddress: "127.0.0.1" },
    },
  );
  const request = await prisma.emailChangeRequest.findUniqueOrThrow({
    where: {
      userId_idempotencyKey: { userId: account.userId, idempotencyKey: key },
    },
    include: { verificationOutbox: true },
  });
  const protectedProof = (
    request.verificationOutbox?.payloadRef as {
      protectedProof?: string;
    }
  ).protectedProof;
  if (!protectedProof) throw new Error("Missing verification proof.");
  return {
    account,
    proposed,
    proof: new EmailChangeProofProtector().unseal(protectedProof),
    requestId: request.id,
  };
}

afterAll(async () => {
  const ids = [...userIds];
  await deleteProfileDatabaseAccounts(ids);
});

describe("email-change verification", () => {
  it("consumes the latest valid proof once and atomically changes login identity", async () => {
    const fixture = await pending("success");
    const outcome = await new VerifyEmailChangeService().execute(
      fixture.proof,
      {
        now: new Date(baseTime.getTime() + 1_000),
      },
    );
    expect(outcome).toEqual({
      status: "success",
      message: expect.any(String),
    });
    expect(
      await prisma.userAccount.findUnique({
        where: { id: fixture.account.userId },
        select: { email: true, normalizedEmail: true, emailVerified: true },
      }),
    ).toEqual({
      email: fixture.proposed,
      normalizedEmail: fixture.proposed,
      emailVerified: true,
    });
    expect(
      await prisma.emailChangeRequest.findUnique({
        where: { id: fixture.requestId },
        select: { status: true, consumedAt: true },
      }),
    ).toEqual({
      status: "CONSUMED",
      consumedAt: expect.any(Date),
    });
    await expect(
      new VerifyEmailChangeService().execute(fixture.proof, {
        now: new Date(baseTime.getTime() + 2_000),
      }),
    ).rejects.toThrow("EMAIL_CHANGE_PROOF_INVALID");
  });

  it("rejects malformed, exactly expired, and superseded proofs safely", async () => {
    await expect(
      new VerifyEmailChangeService().execute("malformed", { now: baseTime }),
    ).rejects.toThrow("EMAIL_CHANGE_PROOF_INVALID");

    const expired = await pending("expired");
    await expect(
      new VerifyEmailChangeService().execute(expired.proof, {
        now: new Date(baseTime.getTime() + 30 * 60_000),
      }),
    ).rejects.toThrow("EMAIL_CHANGE_PROOF_INVALID");
    expect(
      await prisma.emailChangeRequest.findUnique({
        where: { id: expired.requestId },
        select: { status: true },
      }),
    ).toEqual({ status: "EXPIRED" });

    const superseded = await pending(
      "superseded",
      new Date(baseTime.getTime() + 31 * 60_000),
    );
    await serviceFor(superseded.account.userId).execute(
      {
        newEmail: `newer-${randomUUID()}@example.test`,
        currentPassword: "Current password 2026!",
      },
      {
        headers: new Headers(),
        subject: "verification",
        idempotencyKey: "superseding_verification_key_0001",
        now: new Date(baseTime.getTime() + 31 * 60_000 + 1_000),
        networkSource: { remoteAddress: "127.0.0.1" },
      },
    );
    await expect(
      new VerifyEmailChangeService().execute(superseded.proof, {
        now: new Date(baseTime.getTime() + 31 * 60_000 + 2_000),
      }),
    ).rejects.toThrow("EMAIL_CHANGE_PROOF_INVALID");
  });

  it("marks a no-longer-unique proof conflicted without changing the owner", async () => {
    const fixture = await pending(
      "conflict",
      new Date(baseTime.getTime() + 40 * 60_000),
    );
    const competing = await createProfileDatabaseAccount(
      "verify-conflict-owner",
    );
    userIds.add(competing.userId);
    await prisma.userAccount.update({
      where: { id: competing.userId },
      data: {
        email: fixture.proposed,
        normalizedEmail: fixture.proposed,
      },
    });
    await expect(
      new VerifyEmailChangeService().execute(fixture.proof, {
        now: new Date(baseTime.getTime() + 40 * 60_000 + 1_000),
      }),
    ).rejects.toThrow("EMAIL_ADDRESS_UNAVAILABLE");
    expect(
      await prisma.emailChangeRequest.findUnique({
        where: { id: fixture.requestId },
        select: { status: true },
      }),
    ).toEqual({ status: "CONFLICTED" });
    expect(
      await prisma.userAccount.findUnique({
        where: { id: fixture.account.userId },
        select: { email: true },
      }),
    ).toEqual({ email: fixture.account.email });
  });

  it("binds the proof to its target regardless of an unrelated signed-in account", async () => {
    const fixture = await pending(
      "proof-bound",
      new Date(baseTime.getTime() + 50 * 60_000),
    );
    const unrelated = await createProfileDatabaseAccount("verify-unrelated");
    userIds.add(unrelated.userId);
    await new VerifyEmailChangeService().execute(fixture.proof, {
      now: new Date(baseTime.getTime() + 50 * 60_000 + 1_000),
      unrelatedSessionUserId: unrelated.userId,
    });
    expect(
      await prisma.userAccount.findUnique({
        where: { id: fixture.account.userId },
        select: { email: true },
      }),
    ).toEqual({ email: fixture.proposed });
    expect(
      await prisma.userAccount.findUnique({
        where: { id: unrelated.userId },
        select: { email: true },
      }),
    ).toEqual({ email: unrelated.email });
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        actorUserId: fixture.account.userId,
        action: "email_change.verified",
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(JSON.stringify(audit)).not.toContain(fixture.proof);
  });
});
