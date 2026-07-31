import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { deliverOutboxMessage } from "@/backend/email/workers/email-outbox";
import type { EmailMessage } from "@/backend/email/email-service";
import { RequestFullAccountRecoveryService } from "@/backend/services/recovery/request-full-account-recovery";
import { cleanupFixture, enabledFixture } from "../auth/backup-code-fixture";

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
});
