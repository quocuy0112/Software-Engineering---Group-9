import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  authenticationAuditEventSchema,
  type AuthenticationAuditEvent,
} from "@/backend/audit/events";

export class AuditWriter {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async append(input: AuthenticationAuditEvent) {
    const event = authenticationAuditEventSchema.parse(input);
    return this.tx.auditEvent.create({ data: event });
  }
}
