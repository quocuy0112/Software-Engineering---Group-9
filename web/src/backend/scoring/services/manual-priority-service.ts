import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { removePriorityRequestSchema, setPriorityRequestSchema } from "@/shared/contracts/scoring";
import { PrismaScoringRepository } from "../repositories/prisma-scoring-repository";

export class ManualPriorityService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly scoring = new PrismaScoringRepository(db),
  ) {}

  private async authorizedApplication(userId: string, applicationId: string) {
    const app = await this.db.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, jobPostingId: true } });
    if (!app || !(await this.authorization.authorizeApplication(userId, app.jobPostingId, app.id)).authorized) throw new Error("APPLICATION_UNAVAILABLE");
    return app;
  }

  async current(userId: string, applicationId: string) {
    const app = await this.authorizedApplication(userId, applicationId);
    return this.db.manualApplicationPriority.findFirst({ where: { jobApplicationId: app.id, active: true }, orderBy: { version: "desc" }, select: { id: true, value: true, reasonEncrypted: true, setByUserId: true, setAt: true, version: true, active: true } });
  }

  async set(input: { userId: string; sessionId: string; applicationId: string; raw: unknown; now?: Date }) {
    const command = setPriorityRequestSchema.parse(input.raw);
    const app = await this.authorizedApplication(input.userId, input.applicationId);
    const now = input.now ?? new Date();
    const priority = await this.scoring.setPriority({ applicationId: app.id, value: command.value, reason: command.reason, actorUserId: input.userId, now, expectedVersion: command.expectedVersion });
    await new PrismaAuditRepository(this.db).append({ occurredAt: now, actorType: "user", actorUserId: input.userId, actorSessionId: input.sessionId, action: "MANUAL_PRIORITY_SET", targetType: "job_application", targetId: app.id, result: "SUCCESS", correlationId: randomUUID(), context: { reason: "manual-priority-override", state: command.value } }).catch(() => undefined);
    return priority;
  }

  async remove(input: { userId: string; sessionId: string; applicationId: string; raw: unknown; now?: Date }) {
    const command = removePriorityRequestSchema.parse(input.raw);
    const app = await this.authorizedApplication(input.userId, input.applicationId);
    const now = input.now ?? new Date();
    await this.scoring.removePriority({ applicationId: app.id, reason: command.reason, actorUserId: input.userId, now, expectedVersion: command.expectedVersion });
    await new PrismaAuditRepository(this.db).append({ occurredAt: now, actorType: "user", actorUserId: input.userId, actorSessionId: input.sessionId, action: "MANUAL_PRIORITY_REMOVED", targetType: "job_application", targetId: app.id, result: "SUCCESS", correlationId: randomUUID(), context: { reason: "manual-priority-removal" } }).catch(() => undefined);
    return { removed: true } as const;
  }
}
