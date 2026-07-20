import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { authenticationAuditEventSchema, type AuthenticationAuditEvent } from "@/lib/audit/events";

type AuditClient = Pick<typeof prisma, "auditEvent"> | Prisma.TransactionClient;

export class PrismaAuditRepository {
  constructor(private readonly db: AuditClient = prisma) {}

  async append(input: AuthenticationAuditEvent): Promise<string> {
    const event = authenticationAuditEventSchema.parse(input);
    const created = await this.db.auditEvent.create({ data: event });
    return created.id;
  }
}
