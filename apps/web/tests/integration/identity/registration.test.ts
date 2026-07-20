import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { RegisterAccountService, GENERIC_REGISTRATION_MESSAGE } from "@/server/services/identity/register-account";

describe("registration persistence", () => {
  it("creates one complete Pending Verification graph and no browser session", async () => {
    const suffix = randomUUID();
    const email = `candidate-${suffix}@example.test`;
    const result = await new RegisterAccountService(undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue(true)).execute({ name: "Candidate", email, password: "correct horse 2026", passwordConfirmation: "correct horse 2026" }, { subject: suffix });
    expect(result).toEqual({ accepted: true, message: GENERIC_REGISTRATION_MESSAGE });
    const user = await prisma.userAccount.findUnique({ where: { normalizedEmail: email }, include: { accounts: true, candidateIdentity: true, securityTokens: true, outbox: true, sessions: true } });
    expect(user).toMatchObject({ state: "PENDING_VERIFICATION", emailVerified: false });
    expect(user?.accounts).toHaveLength(1);
    expect(user?.accounts[0]?.password).not.toContain("correct horse");
    expect(user?.candidateIdentity).not.toBeNull();
    expect(user?.securityTokens).toHaveLength(1);
    expect(user?.outbox).toHaveLength(1);
    expect(user?.sessions).toHaveLength(0);
  });
  it("returns the same response for normalized duplicate emails", async () => {
    const suffix = randomUUID();
    const service = new RegisterAccountService(undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue(true));
    const first = await service.execute({ name: "One", email: `duplicate-${suffix}@example.test`, password: "correct horse 2026", passwordConfirmation: "correct horse 2026" }, { subject: randomUUID() });
    const second = await service.execute({ name: "Two", email: `duplicate-${suffix}@example.test`, password: "another secure 2026", passwordConfirmation: "another secure 2026" }, { subject: randomUUID() });
    expect(first).toEqual(second);
    expect(await prisma.userAccount.count({ where: { normalizedEmail: `duplicate-${suffix}@example.test` } })).toBe(1);
  });
  it("rolls back user and credential when a later domain write fails", async () => {
    const suffix = randomUUID();
    const gateway = new BetterAuthGateway();
    const repository = new PrismaRegistrationRepository();
    const protector = new TokenProtector();
    const existingEmail = `existing-${suffix}@example.test`;
    const digest = protector.digest(protector.generate());
    await repository.create({ name: "Existing", email: existingEmail, normalizedEmail: existingEmail, credentialPassword: await gateway.preparePasswordForCredential("correct horse 2026"), tokenDigest: digest, protectedToken: protector.seal(protector.generate()), expiresAt: new Date(Date.now() + 86_400_000), correlationId: randomUUID() });
    const failedEmail = `rollback-${suffix}@example.test`;
    await expect(repository.create({ name: "Rollback", email: failedEmail, normalizedEmail: failedEmail, credentialPassword: await gateway.preparePasswordForCredential("correct horse 2026"), tokenDigest: digest, protectedToken: protector.seal(protector.generate()), expiresAt: new Date(Date.now() + 86_400_000), correlationId: randomUUID() })).rejects.toThrow();
    expect(await prisma.userAccount.findUnique({ where: { normalizedEmail: failedEmail } })).toBeNull();
    expect(await prisma.authProviderAccount.count({ where: { accountId: { contains: suffix } } })).toBe(0);
  });
  it("preserves committed registration when email delivery fails", async () => {
    const suffix = randomUUID();
    const email = `delivery-failure-${suffix}@example.test`;
    const result = await new RegisterAccountService(undefined, undefined, undefined, undefined, vi.fn().mockRejectedValue(new Error("provider unavailable"))).execute({ name: "Candidate", email, password: "correct horse 2026", passwordConfirmation: "correct horse 2026" }, { subject: suffix });
    expect(result.accepted).toBe(true);
    expect(await prisma.userAccount.findUnique({ where: { normalizedEmail: email } })).not.toBeNull();
  });
});
