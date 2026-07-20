import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";

describe("append-only audit repository", () => {
  const id = randomUUID();
  afterAll(async () => { await prisma.$disconnect(); });
  it("exposes insert and PostgreSQL rejects update/delete", async () => {
    const repository = new PrismaAuditRepository();
    const created = await repository.append({ occurredAt: new Date(), actorType: "system", action: "registration.rejected", targetType: "request", result: "FAILURE", correlationId: id, context: {} });
    await expect(prisma.auditEvent.update({ where: { id: created }, data: { result: "SUCCESS" } })).rejects.toThrow();
    await expect(prisma.auditEvent.delete({ where: { id: created } })).rejects.toThrow();
  });
});
