import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaMessagingReportRepository } from "@/backend/repositories/messaging/prisma-messaging-report-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import type { MessagingReportInput } from "@/shared/contracts/messaging/safety";

export class ReportMessagingService {
  constructor(
    private readonly reports = new PrismaMessagingReportRepository(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}

  async execute(
    actor: { userId: string; sessionId: string },
    input: MessagingReportInput,
    now = new Date(),
  ) {
    const result = await this.reports.submit({
      ...input,
      reporterUserId: actor.userId,
      now,
    });
    await this.audit.append({
      occurredAt: now,
      actorType: "user",
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      action: "messaging.report.submitted",
      targetType: "messaging_conversation",
      targetId: input.conversationId,
      result: "SUCCESS",
      correlationId: randomUUID(),
      context: { duplicate: result.deduplicated },
    });
    return { receipt: "REPORT_RECEIVED" as const };
  }
}
