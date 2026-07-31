import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { authenticationAuditEventSchema } from "@/backend/audit/events";
import { DueOutboxProcessor } from "@/backend/email/workers/due-outbox-processor";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";

const ids: string[] = [];

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { id: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { correlationId: { in: ids } } });
  await prisma.$disconnect();
});

describe("Feature 002 audit and protected-recipient outbox", () => {
  it.each([
    ["email_change.requested", "email_change"],
    ["email_change.rejected", "email_change"],
    ["email_change.superseded", "email_change"],
    ["email_change.verified", "email_change"],
    ["email_change.verification_failed", "email_change"],
    ["password_change.intent_recorded", "password_change"],
    ["password_change.succeeded", "password_change"],
    ["password_change.failed", "password_change"],
    ["password_change.locked", "password_change"],
  ])("allowlists %s for %s", (action, targetType) => {
    expect(
      authenticationAuditEventSchema.safeParse({
        occurredAt: new Date(),
        actorType: "user",
        actorUserId: "user-opaque",
        actorSessionId: "session-opaque",
        action,
        targetType,
        targetId: "target-opaque",
        result: "SUCCESS",
        correlationId: "correlation-opaque",
        ipPrefixDigest: "network-digest",
        context: { reason: "accepted" },
      }).success,
    ).toBe(true);
  });

  it("rejects secret, recipient, and raw-network audit context", async () => {
    const repository = new PrismaAuditRepository();
    const base = {
      occurredAt: new Date(),
      actorType: "user" as const,
      actorUserId: "user-opaque",
      actorSessionId: "session-opaque",
      action: "email_change.rejected" as const,
      targetType: "email_change" as const,
      targetId: "target-opaque",
      result: "DENIED" as const,
      correlationId: randomUUID(),
      ipPrefixDigest: "protected-prefix",
    };
    await expect(
      repository.append({
        ...base,
        context: { email: "candidate@example.test" } as never,
      }),
    ).rejects.toThrow();
    await expect(
      repository.append({
        ...base,
        context: { rawIp: "203.0.113.9" } as never,
      }),
    ).rejects.toThrow();
    await expect(
      repository.append({
        ...base,
        context: { proof: "secret-proof" } as never,
      }),
    ).rejects.toThrow();
  });

  it("creates one protected intent and decrypts only at adapter delivery", async () => {
    const idempotencyKey = `protected-outbox-${randomUUID()}`;
    const recipient = `protected-${randomUUID()}@example.test`;
    const protector = new ProtectedOutboxRecipient();
    const repository = new PrismaOutboxRepository();
    const input = {
      kind: "PASSWORD_CHANGED" as const,
      recipientRef: `logical:${randomUUID()}`,
      recipientCiphertext: protector.seal(
        recipient,
        "password-change-notice.v1",
      ),
      recipientPurpose: "password-change-notice.v1" as const,
      templateVersion: "password-changed.v1",
      payloadRef: {
        zeta: "last",
        alpha: "first",
        nested: { right: 2, left: 1 },
      },
      idempotencyKey,
    };
    const [first, second] = await Promise.all([
      repository.enqueueIdempotent(input),
      repository.enqueueIdempotent(input),
    ]);
    expect(first.id).toBe(second.id);
    ids.push(first.id);
    const persisted = await prisma.emailOutbox.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(JSON.stringify(persisted)).not.toContain(recipient);

    const send = vi
      .fn()
      .mockResolvedValue({ providerMessageId: "provider-id" });
    const only = {
      claimDue: async (owner: string, now: Date) => {
        const row = await repository.claimOne(first.id, owner, now);
        return row ? [row] : [];
      },
      markSent: repository.markSent.bind(repository),
      markFailure: repository.markFailure.bind(repository),
    } as PrismaOutboxRepository;
    await new DueOutboxProcessor(
      only,
      { send },
      "protected-worker",
      1,
    ).pollOnce();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].recipient).toBe(recipient);
    expect(JSON.stringify(send.mock.calls[0]?.[0])).not.toContain(
      input.recipientCiphertext,
    );
  });
});
