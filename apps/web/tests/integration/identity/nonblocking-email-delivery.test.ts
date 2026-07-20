import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { RegisterAccountService } from "@/server/services/identity/register-account";
describe("non-blocking transactional email requests", () => {
  it("registration commits outbox without awaiting delivery", async () => {
    const suffix = randomUUID(); const email = `nonblocking-${suffix}@example.test`; const delivery = vi.fn(() => new Promise(() => undefined));
    const started = Date.now();
    const result = await new RegisterAccountService(undefined, undefined, undefined, undefined, delivery).execute({ name: "Candidate", email, password: "correct horse 2026", passwordConfirmation: "correct horse 2026" }, { subject: suffix });
    expect(Date.now() - started).toBeLessThan(3000); expect(result.accepted).toBe(true); expect(delivery).not.toHaveBeenCalled();
    expect(await prisma.emailOutbox.count({ where: { user: { normalizedEmail: email }, status: "PENDING" } })).toBe(1);
  });
});
