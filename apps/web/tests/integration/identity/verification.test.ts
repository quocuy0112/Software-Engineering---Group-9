import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { deliverOutboxMessage } from "@/server/email/workers/email-outbox";
import { EmailDeliveryError } from "@/server/email/email-service";
import { CaptureEmailAdapter } from "@/server/email/capture-adapter";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { ResendVerificationService, GENERIC_RESEND_MESSAGE } from "@/server/services/identity/resend-verification";
import { VerifyEmailService } from "@/server/services/identity/verify-email";

const protector = new TokenProtector();
const registration = new PrismaRegistrationRepository();
const gateway = new BetterAuthGateway();

async function pending(prefix: string, expiresAt = new Date(Date.now() + 86_400_000)) {
  const id = randomUUID();
  const email = `${prefix}-${id}@example.test`;
  const raw = protector.generate();
  const created = await registration.create({ name: "Candidate", email, normalizedEmail: email, credentialPassword: await gateway.preparePasswordForCredential("correct horse 2026"), tokenDigest: protector.digest(raw), protectedToken: protector.seal(raw), expiresAt, correlationId: randomUUID() });
  return { ...created, email, raw };
}

describe("email verification", () => {
  it("activates once and rejects reuse", async () => {
    const fixture = await pending("success");
    const service = new VerifyEmailService();
    expect(await service.execute(fixture.raw)).toEqual({ success: true });
    expect((await service.execute(fixture.raw)).success).toBe(false);
    expect(await prisma.userAccount.findUnique({ where: { id: fixture.userId }, select: { state: true, emailVerified: true } })).toEqual({ state: "ACTIVE", emailVerified: true });
  });
  it("rejects invalid and expired values", async () => {
    expect((await new VerifyEmailService().execute(protector.generate())).success).toBe(false);
    const expiresAt = new Date(Date.now() + 1000);
    const fixture = await pending("expired", expiresAt);
    expect(await new VerifyEmailService().execute(fixture.raw, new Date(expiresAt.getTime() + 1000))).toMatchObject({ success: false, reason: "expired" });
  });
  it("allows exactly one concurrent verification", async () => {
    const fixture = await pending("concurrent");
    const results = await Promise.all([new VerifyEmailService().execute(fixture.raw), new VerifyEmailService().execute(fixture.raw)]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(await prisma.securityToken.count({ where: { userId: fixture.userId, status: "CONSUMED" } })).toBe(1);
  });
  it.each(["ACTIVE", "SUSPENDED", "DELETED"] as const)("rejects a token for a %s account", async (state) => {
    const fixture = await pending(state.toLowerCase());
    await prisma.userAccount.update({ where: { id: fixture.userId }, data: { state, deletedAt: state === "DELETED" ? new Date() : null, emailVerified: state === "ACTIVE" } });
    expect((await new VerifyEmailService().execute(fixture.raw)).success).toBe(false);
  });
  it("replaces active tokens on resend and is enumeration resistant", async () => {
    const fixture = await pending("resend");
    const delivery = vi.fn().mockResolvedValue(true);
    const service = new ResendVerificationService(undefined, undefined, undefined, delivery);
    const known = await service.execute(fixture.email, randomUUID());
    const unknown = await service.execute(`unknown-${randomUUID()}@example.test`, randomUUID());
    expect(known.message).toBe(GENERIC_RESEND_MESSAGE);
    expect(unknown.message).toBe(GENERIC_RESEND_MESSAGE);
    expect(await prisma.securityToken.count({ where: { userId: fixture.userId, status: "ACTIVE" } })).toBe(1);
    expect(await prisma.securityToken.count({ where: { userId: fixture.userId, status: "SUPERSEDED" } })).toBe(1);
  });
  it("rate limits resend generically", async () => {
    const email = `nobody-${randomUUID()}@example.test`;
    const subject = randomUUID();
    const service = new ResendVerificationService();
    const results = [];
    for (let index = 0; index < 4; index++) results.push(await service.execute(email, subject));
    expect(results[3]).toMatchObject({ accepted: false, status: 429, message: GENERIC_RESEND_MESSAGE });
  });
  it("writes a retrievable local capture without logging the token", async () => {
    const fixture = await pending("capture");
    const directory = resolve(process.cwd(), ".local/mail");
    const before = new Set(await readdir(directory).catch(() => []));
    expect(await deliverOutboxMessage(fixture.outboxId, new CaptureEmailAdapter())).toBe(true);
    const after = (await readdir(directory)).filter((name) => !before.has(name));
    expect(after).toHaveLength(1);
    const content = await readFile(resolve(directory, after[0]!), "utf8");
    expect(content).toContain("http://localhost:3000/verify-email?token=");
    expect(content).toContain("X-SmartHire-Idempotency-Key");
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: fixture.outboxId } });
    expect(JSON.stringify(row.payloadRef)).not.toContain(fixture.raw);
  });
  it("dead-letters repeated delivery failure and emits a secret-free audit event", async () => {
    const fixture = await pending("dead-letter");
    const failing = { send: vi.fn().mockRejectedValue(new Error("provider secret details")) };
    for (let attempt = 0; attempt < 5; attempt++) expect(await deliverOutboxMessage(fixture.outboxId, failing)).toBe(false);
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: fixture.outboxId } });
    expect(row.status).toBe("DEAD");
    expect(row.safeErrorCode).toBe("INTERNAL_ERROR");
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: "email.delivery_failed", targetId: fixture.outboxId } });
    expect(JSON.stringify(audit)).not.toContain("provider secret details");
  });
  it("keeps retryable SMTP failures retryable and dead-letters terminal SMTP failures immediately", async () => {
    const retryable = await pending("smtp-retryable");
    const temporaryAdapter = { send: vi.fn().mockRejectedValue(new EmailDeliveryError("SMTP_CONNECTION_TIMEOUT", true)) };
    expect(await deliverOutboxMessage(retryable.outboxId, temporaryAdapter)).toBe(false);
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: retryable.outboxId }, select: { status: true, safeErrorCode: true } })).toEqual({ status: "RETRYABLE", safeErrorCode: "SMTP_CONNECTION_TIMEOUT" });

    const terminal = await pending("smtp-terminal");
    const terminalAdapter = { send: vi.fn().mockRejectedValue(new EmailDeliveryError("SMTP_AUTH_FAILED", false)) };
    expect(await deliverOutboxMessage(terminal.outboxId, terminalAdapter)).toBe(false);
    expect(await prisma.emailOutbox.findUniqueOrThrow({ where: { id: terminal.outboxId }, select: { status: true, attempts: true, safeErrorCode: true } })).toEqual({ status: "DEAD", attempts: 1, safeErrorCode: "SMTP_AUTH_FAILED" });
  });
});
