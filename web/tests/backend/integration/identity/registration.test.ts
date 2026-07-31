import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { PrismaRegistrationRepository } from "@/backend/repositories/identity/prisma-registration-repository";
import {
  RegisterAccountService,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  GENERIC_REGISTRATION_MESSAGE,
} from "@/backend/services/identity/register-account";
import { registrationSchema } from "@/shared/contracts/identity/registration";

describe("registration persistence", () => {
  it("creates one graph under concurrent normalized duplicate registration", async () => {
    const suffix = randomUUID();
    const email = `Concurrent-${suffix}@Example.Test`;
    const service = new RegisterAccountService(
      undefined,
      undefined,
      undefined,
      undefined,
      vi.fn().mockResolvedValue(true),
    );
    const input = registrationSchema.parse({
      name: "Concurrent Candidate",
      email,
      password: "correct horse 2026",
      passwordConfirmation: "correct horse 2026",
    });
    const [first, second] = await Promise.all([
      service.execute(input, { subject: randomUUID() }),
      service.execute(
        registrationSchema.parse({
          ...input,
          email: `  ${email.toLocaleLowerCase("en-US")}  `,
        }),
        { subject: randomUUID() },
      ),
    ]);
    expect([first.accepted, second.accepted].sort()).toEqual([false, true]);
    expect([first.message, second.message]).toContain(
      EMAIL_ALREADY_REGISTERED_MESSAGE,
    );
    const users = await prisma.userAccount.findMany({
      where: { normalizedEmail: email.toLocaleLowerCase("en-US") },
      include: { candidateIdentity: true, securityTokens: true, outbox: true },
    });
    expect(users).toHaveLength(1);
    expect(users[0]?.candidateIdentity).not.toBeNull();
    expect(users[0]?.securityTokens).toHaveLength(1);
    expect(users[0]?.outbox).toHaveLength(1);
  });
  it("creates one complete Pending Verification graph and no browser session", async () => {
    const suffix = randomUUID();
    const email = `candidate-${suffix}@example.test`;
    const result = await new RegisterAccountService(
      undefined,
      undefined,
      undefined,
      undefined,
      vi.fn().mockResolvedValue(true),
    ).execute(
      {
        name: "Candidate",
        email,
        password: "correct horse 2026",
        passwordConfirmation: "correct horse 2026",
      },
      { subject: suffix },
    );
    expect(result).toEqual({
      accepted: true,
      message: GENERIC_REGISTRATION_MESSAGE,
    });
    const user = await prisma.userAccount.findUnique({
      where: { normalizedEmail: email },
      include: {
        accounts: true,
        candidateIdentity: true,
        securityTokens: true,
        outbox: true,
        sessions: true,
      },
    });
    expect(user).toMatchObject({
      state: "PENDING_VERIFICATION",
      emailVerified: false,
    });
    expect(user?.accounts).toHaveLength(1);
    expect(user?.accounts[0]?.password).not.toContain("correct horse");
    expect(user?.candidateIdentity).not.toBeNull();
    expect(user?.securityTokens).toHaveLength(1);
    expect(user?.outbox).toHaveLength(1);
    expect(user?.sessions).toHaveLength(0);
  });
  it("returns a conflict for normalized duplicate emails", async () => {
    const suffix = randomUUID();
    const service = new RegisterAccountService(
      undefined,
      undefined,
      undefined,
      undefined,
      vi.fn().mockResolvedValue(true),
    );
    const first = await service.execute(
      {
        name: "One",
        email: `duplicate-${suffix}@example.test`,
        password: "correct horse 2026",
        passwordConfirmation: "correct horse 2026",
      },
      { subject: randomUUID() },
    );
    const second = await service.execute(
      {
        name: "Two",
        email: `duplicate-${suffix}@example.test`,
        password: "another secure 2026",
        passwordConfirmation: "another secure 2026",
      },
      { subject: randomUUID() },
    );
    expect(first).toEqual({
      accepted: true,
      message: GENERIC_REGISTRATION_MESSAGE,
    });
    expect(second).toEqual({
      accepted: false,
      status: 409,
      message: EMAIL_ALREADY_REGISTERED_MESSAGE,
    });
    expect(
      await prisma.userAccount.count({
        where: { normalizedEmail: `duplicate-${suffix}@example.test` },
      }),
    ).toBe(1);
  });
  it("rolls back user and credential when a later domain write fails", async () => {
    const suffix = randomUUID();
    const gateway = new BetterAuthGateway();
    const repository = new PrismaRegistrationRepository();
    const protector = new TokenProtector();
    const existingEmail = `existing-${suffix}@example.test`;
    const digest = protector.digest(protector.generate());
    await repository.create({
      name: "Existing",
      email: existingEmail,
      normalizedEmail: existingEmail,
      credentialPassword:
        await gateway.preparePasswordForCredential("correct horse 2026"),
      tokenDigest: digest,
      protectedToken: protector.seal(protector.generate()),
      expiresAt: new Date(Date.now() + 86_400_000),
      correlationId: randomUUID(),
    });
    const failedEmail = `rollback-${suffix}@example.test`;
    await expect(
      repository.create({
        name: "Rollback",
        email: failedEmail,
        normalizedEmail: failedEmail,
        credentialPassword:
          await gateway.preparePasswordForCredential("correct horse 2026"),
        tokenDigest: digest,
        protectedToken: protector.seal(protector.generate()),
        expiresAt: new Date(Date.now() + 86_400_000),
        correlationId: randomUUID(),
      }),
    ).rejects.toThrow();
    expect(
      await prisma.userAccount.findUnique({
        where: { normalizedEmail: failedEmail },
      }),
    ).toBeNull();
    expect(
      await prisma.authProviderAccount.count({
        where: { accountId: { contains: suffix } },
      }),
    ).toBe(0);
  });
  it("preserves committed registration when email delivery fails", async () => {
    const suffix = randomUUID();
    const email = `delivery-failure-${suffix}@example.test`;
    const result = await new RegisterAccountService(
      undefined,
      undefined,
      undefined,
      undefined,
      vi.fn().mockRejectedValue(new Error("provider unavailable")),
    ).execute(
      {
        name: "Candidate",
        email,
        password: "correct horse 2026",
        passwordConfirmation: "correct horse 2026",
      },
      { subject: suffix },
    );
    expect(result.accepted).toBe(true);
    expect(
      await prisma.userAccount.findUnique({
        where: { normalizedEmail: email },
      }),
    ).not.toBeNull();
  });
});
