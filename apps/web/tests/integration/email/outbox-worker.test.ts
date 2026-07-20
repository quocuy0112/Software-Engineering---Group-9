import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { DueOutboxProcessor } from "@/server/email/workers/due-outbox-processor";
import { EmailDeliveryError } from "@/server/email/email-service";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { PrismaOutboxRepository } from "@/server/repositories/email/outbox-repository";
async function pending(prefix: string) {
  const id=randomUUID(), email=`${prefix}-${id}@example.test`, protector=new TokenProtector();
  return new PrismaRegistrationRepository().create({ name:"Candidate", email, normalizedEmail:email, credentialPassword:await new BetterAuthGateway().preparePasswordForCredential("correct horse 2026"), tokenDigest:protector.digest(protector.generate()), protectedToken:protector.seal(protector.generate()), expiresAt:new Date(Date.now()+86_400_000), correlationId:id });
}
describe("due outbox worker", () => {
  const only = (id: string, repository = new PrismaOutboxRepository()) => ({
    claimDue: async (owner: string, now: Date) => { const row = await repository.claimOne(id, owner, now); return row ? [row] : []; },
    markSent: repository.markSent.bind(repository),
    markFailure: repository.markFailure.bind(repository),
  }) as PrismaOutboxRepository;
  it("prevents duplicate concurrent delivery", async () => {
    const fixture=await pending("claim"), send=vi.fn().mockResolvedValue({providerMessageId:"one"});
    await Promise.all([new DueOutboxProcessor(only(fixture.outboxId),{send},"a",1).pollOnce(),new DueOutboxProcessor(only(fixture.outboxId),{send},"b",1).pollOnce()]);
    expect(send).toHaveBeenCalledTimes(1); expect((await prisma.emailOutbox.findUniqueOrThrow({where:{id:fixture.outboxId}})).status).toBe("SENT");
  });
  it("recovers stale leases and reaches DEAD with one audit", async () => {
    const fixture=await pending("restart"); await prisma.emailOutbox.update({where:{id:fixture.outboxId},data:{status:"PROCESSING",leaseOwner:"dead",leaseExpiresAt:new Date(0)}});
    const send=vi.fn().mockRejectedValue(new EmailDeliveryError("SMTP_CONNECTION_TIMEOUT",true));
    for(let attempt=0;attempt<5;attempt++){await prisma.emailOutbox.update({where:{id:fixture.outboxId},data:{nextAttemptAt:new Date(0),leaseExpiresAt:new Date(0)}});await new DueOutboxProcessor(only(fixture.outboxId),{send},`w${attempt}`,1).pollOnce();}
    const row=await prisma.emailOutbox.findUniqueOrThrow({where:{id:fixture.outboxId}}); expect(row).toMatchObject({status:"DEAD",attempts:5,safeErrorCode:"SMTP_CONNECTION_TIMEOUT"});
    expect(await prisma.auditEvent.count({where:{action:"email.delivery_failed",targetId:fixture.outboxId}})).toBe(1);
  });
});
