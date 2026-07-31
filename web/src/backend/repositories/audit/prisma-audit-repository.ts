import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  authenticationAuditEventSchema,
  type AuthenticationAuditEvent,
} from "@/backend/audit/events";

type AuditClient = Pick<typeof prisma, "auditEvent"> | Prisma.TransactionClient;

export class PrismaAuditRepository {
  constructor(private readonly db: AuditClient = prisma) {}

  private validated(input: AuthenticationAuditEvent) {
    // The strict event/context schemas are the persistence allowlist. Never
    // pass caller-owned request/provider objects directly to Prisma.
    return authenticationAuditEventSchema.parse(input);
  }

  async append(input: AuthenticationAuditEvent): Promise<string> {
    const event = this.validated(input);
    const created = await this.db.auditEvent.create({ data: event });
    return created.id;
  }

  async appendIdempotent(
    id: string,
    input: AuthenticationAuditEvent,
  ): Promise<string> {
    const event = this.validated(input);
    try {
      const created = await this.db.auditEvent.create({
        data: { id, ...event },
      });
      return created.id;
    } catch (error) {
      const existing = await this.db.auditEvent.findUnique({
        where: { id },
        select: { id: true },
      });
      if (existing) return existing.id;
      throw error;
    }
  }
}
