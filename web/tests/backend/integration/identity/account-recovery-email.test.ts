import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { deliverOutboxMessage } from "@/backend/email/workers/email-outbox";
import type { EmailMessage } from "@/backend/email/email-service";
import { RequestFullAccountRecoveryService } from "@/backend/services/recovery/request-full-account-recovery";
import { cleanupFixture, enabledFixture } from "../auth/backup-code-fixture";
import { createCredentialFixture } from "../../../helpers/credential-fixture";

const users: string[] = [];
const protector = new TokenProtector();

afterEach(async () => {
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

describe("full account recovery email proof delivery", () => {
  it("renders a fragment proof while persistence retains only digest and sealed ciphertext", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    await new RequestFullAccountRecoveryService().execute(
      fixture.email,
      new Date(),
    );
    const outbox = await prisma.emailOutbox.findFirstOrThrow({
      where: {
        userId: fixture.userId,
        templateVersion: "account-recovery-confirmation.v1",
      },
    });
    const payload = outbox.payloadRef as { protectedProof: string };
    const rawProof = protector.unseal(payload.protectedProof);
    const delivered: EmailMessage[] = [];
    const send = vi.fn(async (message: EmailMessage) => {
      delivered.push(message);
      return { providerMessageId: "capture:test" };
    });
    await expect(deliverOutboxMessage(outbox.id, { send })).resolves.toBe(true);
    const message = delivered[0];
    expect(message?.text).toContain(
      `/account-recovery/confirm#proof=${rawProof}`,
    );
    expect(message?.text).not.toContain(
      `/account-recovery/confirm?proof=${rawProof}`,
    );
    const persisted = JSON.stringify(
      await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox.id } }),
    );
    expect(persisted).not.toContain(rawProof);
  });

  it("queues a password-reset email for an active account that has no second factor", async () => {
    const fixture = await createCredentialFixture({
      name: "Password-only recovery",
      email: `password-only-${crypto.randomUUID()}@example.test`,
      password: "Password-only recovery 2026!",
    });
    users.push(fixture.id);

    await expect(
      new RequestFullAccountRecoveryService().execute(
        fixture.email,
        new Date(),
      ),
    ).resolves.toMatchObject({ accepted: true, status: 202 });
    await expect(
      prisma.emailOutbox.findFirstOrThrow({
        where: { userId: fixture.id, templateVersion: "reset-password.v1" },
        select: { kind: true, status: true },
      }),
    ).resolves.toEqual({ kind: "RESET_PASSWORD", status: "PENDING" });
  });
});
