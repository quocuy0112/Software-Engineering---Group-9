import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";
import { RequestEmailChangeService } from "@/backend/services/account/request-email-change";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let occupied: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;

const now = new Date("2026-07-31T02:00:00.000Z");
const headers = new Headers();

function serviceFor(userId: string, sessionId = `session-${userId}`) {
  return new RequestEmailChangeService({
    recentAuth: {
      execute: vi.fn().mockResolvedValue({
        ok: true,
        userId,
        sessionId,
      }),
    },
  });
}

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("email-request-owner");
  occupied = await createProfileDatabaseAccount("email-request-occupied");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([owner.userId, occupied.userId]);
});

describe("email-change request flow", () => {
  it("requires recent auth before creating any durable intent", async () => {
    const denied = new RequestEmailChangeService({
      recentAuth: {
        execute: vi.fn().mockResolvedValue({ ok: false, status: 401 }),
      },
    });
    await expect(
      denied.execute(
        {
          newEmail: "recent-auth-denied@example.test",
          currentPassword: "wrong",
        },
        {
          headers,
          subject: "test",
          idempotencyKey: "recent_auth_denied_key_0001",
          now,
          networkSource: { remoteAddress: "127.0.0.1" },
        },
      ),
    ).rejects.toThrow("RECENT_AUTH_REQUIRED");
    expect(
      await prisma.emailChangeRequest.count({
        where: { userId: owner.userId },
      }),
    ).toBe(0);
  });

  it("atomically reserves, snapshots both recipients, queues two intents, and audits", async () => {
    const proposedEmail = `Proposed.${owner.userId.slice(-12)}@Example.TEST`;
    const result = await serviceFor(owner.userId).execute(
      {
        newEmail: proposedEmail,
        currentPassword: "Current password 2026!",
      },
      {
        headers,
        subject: "test",
        idempotencyKey: "email_change_request_key_0001",
        now,
        networkSource: { remoteAddress: "127.0.0.1" },
      },
    );
    expect(result).toEqual({
      status: "verification-queued",
      expiresAt: "2026-07-31T02:30:00.000Z",
      message: expect.any(String),
    });
    expect(
      await prisma.userAccount.findUnique({
        where: { id: owner.userId },
        select: { email: true },
      }),
    ).toEqual({ email: owner.email });

    const request = await prisma.emailChangeRequest.findFirstOrThrow({
      where: { userId: owner.userId, status: "PENDING" },
    });
    const outbox = await prisma.emailOutbox.findMany({
      where: {
        id: {
          in: [request.verificationOutboxId!, request.oldEmailNoticeOutboxId!],
        },
      },
      orderBy: { kind: "asc" },
    });
    expect(outbox).toHaveLength(2);
    const recipients = new ProtectedOutboxRecipient();
    expect(
      outbox.map((row) =>
        recipients.unseal(
          row.recipientCiphertext!,
          row.recipientPurpose as
            | "email-change-verification.v1"
            | "email-change-old-address.v1",
        ),
      ),
    ).toEqual(expect.arrayContaining([proposedEmail, owner.email]));
    expect(JSON.stringify(outbox)).not.toContain("Current password 2026!");
    expect(
      await prisma.auditEvent.count({
        where: {
          actorUserId: owner.userId,
          action: "email_change.requested",
          result: "SUCCESS",
        },
      }),
    ).toBe(1);
  });

  it("replays the same key without new proof/mail and rejects a changed binding", async () => {
    const service = serviceFor(owner.userId);
    const context = {
      headers,
      subject: "test",
      idempotencyKey: "email_change_request_key_0001",
      now: new Date(now.getTime() + 1_000),
      networkSource: { remoteAddress: "127.0.0.1" },
    };
    const replay = await service.execute(
      {
        newEmail: `proposed.${owner.userId.slice(-12)}@example.test`,
        currentPassword: "Current password 2026!",
      },
      context,
    );
    expect(replay.status).toBe("verification-queued");
    expect(
      await prisma.emailOutbox.count({
        where: { userId: owner.userId },
      }),
    ).toBe(2);
    await expect(
      service.execute(
        {
          newEmail: "changed-binding@example.test",
          currentPassword: "Current password 2026!",
        },
        context,
      ),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("supersedes the prior request and commits no provider delivery", async () => {
    const newestEmail = `newest-${owner.userId.slice(-12)}@example.test`;
    const result = await serviceFor(owner.userId).execute(
      {
        newEmail: newestEmail,
        currentPassword: "Current password 2026!",
      },
      {
        headers,
        subject: "test",
        idempotencyKey: "email_change_request_key_0002",
        now: new Date(now.getTime() + 2_000),
        networkSource: { remoteAddress: "127.0.0.1" },
      },
    );
    expect(result.status).toBe("verification-queued");
    const requests = await prisma.emailChangeRequest.findMany({
      where: { userId: owner.userId },
      orderBy: { createdAt: "asc" },
    });
    expect(requests.map(({ status }) => status)).toEqual([
      "SUPERSEDED",
      "PENDING",
    ]);
    expect(
      await prisma.emailOutbox.count({
        where: { userId: owner.userId, status: "PENDING" },
      }),
    ).toBe(4);
  });

  it("rejects an occupied address with a redacted durable audit", async () => {
    await expect(
      serviceFor(owner.userId).execute(
        {
          newEmail: occupied.email.toUpperCase(),
          currentPassword: "Current password 2026!",
        },
        {
          headers,
          subject: "test",
          idempotencyKey: "email_change_request_key_0003",
          now: new Date(now.getTime() + 3_000),
          networkSource: { remoteAddress: "127.0.0.1" },
        },
      ),
    ).rejects.toThrow("EMAIL_ADDRESS_UNAVAILABLE");
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        actorUserId: owner.userId,
        action: "email_change.rejected",
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(JSON.stringify(audit)).not.toContain(occupied.email);
  });
});
