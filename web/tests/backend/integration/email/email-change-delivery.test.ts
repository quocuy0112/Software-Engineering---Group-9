import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import type { EmailMessage, EmailService } from "@/backend/email/email-service";
import { deliverOutboxMessage } from "@/backend/email/workers/email-outbox";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";
import { RequestEmailChangeService } from "@/backend/services/account/request-email-change";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
const now = new Date("2026-07-31T05:00:00.000Z");
const messages: EmailMessage[] = [];
const adapter: EmailService = {
  async send(message) {
    messages.push(structuredClone(message));
    return { providerMessageId: `capture-${messages.length}` };
  },
};

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("email-delivery");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([owner.userId]);
});

describe("email-change outbox delivery", () => {
  it("keeps recipients/proof protected at rest and maps purpose-bound templates", async () => {
    const proposed = `delivery-${randomUUID()}@example.test`;
    const service = new RequestEmailChangeService({
      recentAuth: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          userId: owner.userId,
          sessionId: `session-${owner.userId}`,
        }),
      },
    });
    await service.execute(
      { newEmail: proposed, currentPassword: "Current password 2026!" },
      {
        headers: new Headers(),
        subject: "delivery",
        idempotencyKey: "email_change_delivery_key_0001",
        now,
        networkSource: { remoteAddress: "127.0.0.1" },
      },
    );
    const request = await prisma.emailChangeRequest.findFirstOrThrow({
      where: { userId: owner.userId, status: "PENDING" },
      include: {
        verificationOutbox: true,
        oldEmailNoticeOutbox: true,
      },
    });
    const verification = request.verificationOutbox!;
    const alert = request.oldEmailNoticeOutbox!;
    const protectedProof = (
      verification.payloadRef as { protectedProof?: string }
    ).protectedProof!;
    const rawProof = new EmailChangeProofProtector().unseal(protectedProof);

    expect(verification.recipientCiphertext).not.toContain(proposed);
    expect(alert.recipientCiphertext).not.toContain(owner.email);
    expect(JSON.stringify(verification.payloadRef)).not.toContain(rawProof);
    expect(JSON.stringify(alert.payloadRef)).not.toContain(rawProof);

    expect(await deliverOutboxMessage(verification.id, adapter)).toBe(true);
    expect(await deliverOutboxMessage(alert.id, adapter)).toBe(true);
    expect(await deliverOutboxMessage(verification.id, adapter)).toBe(false);
    expect(messages).toHaveLength(2);

    const verificationMail = messages.find(
      ({ recipient }) => recipient === proposed,
    )!;
    const oldAddressMail = messages.find(
      ({ recipient }) => recipient === owner.email,
    )!;
    expect(verificationMail.kind).toBe("EMAIL_CHANGE_VERIFY");
    expect(`${verificationMail.html}\n${verificationMail.text}`).toContain(
      "/verify-email-change#proof=",
    );
    expect(`${verificationMail.html}\n${verificationMail.text}`).toContain(
      encodeURIComponent(rawProof),
    );
    expect(oldAddressMail.kind).toBe("SECURITY_ALERT");
    expect(`${oldAddressMail.html}\n${oldAddressMail.text}`).not.toMatch(
      /proof=|token|\/verify-email-change/i,
    );
    expect(JSON.stringify(oldAddressMail)).not.toContain(rawProof);
  });

  it("does not place plaintext proof, recipient, or full links in audit/retry metadata", async () => {
    const outbox = await prisma.emailOutbox.findMany({
      where: { userId: owner.userId },
    });
    const audits = await prisma.auditEvent.findMany({
      where: { actorUserId: owner.userId },
    });
    const serializedAudit = JSON.stringify(audits);
    expect(serializedAudit).not.toContain(owner.email);
    expect(serializedAudit).not.toContain("/verify-email-change");
    for (const row of outbox) {
      expect(row.safeErrorCode ?? "").not.toMatch(/@|proof|token/i);
      expect(row.providerMessageId ?? "").not.toMatch(/@|proof|token/i);
    }
  });
});
