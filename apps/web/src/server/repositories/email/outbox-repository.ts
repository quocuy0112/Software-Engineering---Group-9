import "server-only";
import type { EmailKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type OutboxClient = Pick<typeof prisma, "emailOutbox"> | Prisma.TransactionClient;

export class PrismaOutboxRepository {
  constructor(private readonly db: OutboxClient = prisma) {}
  async enqueue(input: { kind: EmailKind; userId: string; securityTokenId: string; recipientRef: string; templateVersion: string; payloadRef: Prisma.InputJsonValue; idempotencyKey: string }) {
    return this.db.emailOutbox.create({ data: input });
  }
}
