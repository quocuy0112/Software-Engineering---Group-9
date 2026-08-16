import "server-only";
import { Prisma, type PlatformAdministratorScope } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { PrismaAdminCommandRepository, AdminCommandConflict } from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import { jobManagementCommandSchema, jobManagementListQuerySchema, type JobManagementCommand } from "@/shared/contracts/admin/job-post-management";

const scopes: Record<JobManagementCommand["command"], PlatformAdministratorScope> = {
  HIDE: "JOB_POST_MODERATE", RESTORE: "JOB_POST_MODERATE", CLOSE_APPLICATIONS: "JOB_POST_MODERATE", REOPEN_APPLICATIONS: "JOB_POST_MODERATE", ARCHIVE: "JOB_POST_MODERATE", REQUEST_CHANGES: "JOB_POST_MODERATE", FEATURE: "JOB_POST_FEATURE", UNFEATURE: "JOB_POST_FEATURE", SOFT_DELETE: "JOB_POST_ENFORCE", ENFORCE: "JOB_POST_ENFORCE",
};

function stateOf(row: { visibilityState: string; applicationState: string; softDeletedAt: Date | null }) {
  return { visibility: row.visibilityState, applicationState: row.applicationState, softDeleted: Boolean(row.softDeletedAt) };
}

export class JobPostManagementService {
  async assertScope(authority: AdminAuthority, scope: PlatformAdministratorScope, tx = prisma) {
    const grant = await tx.platformAdministratorGrant.findFirst({
      where: { id: authority.grantId, userId: authority.userId, state: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], scopes: { some: { scope } } },
      select: { id: true },
    });
    if (!grant) throw new Error("ACTION_BLOCKED");
  }

  async list(authority: AdminAuthority, query: unknown) {
    await this.assertScope(authority, "JOB_POST_MODERATE");
    const input = jobManagementListQuerySchema.parse(query);
    const search = input.q?.toLowerCase();
    const where: Prisma.JobPostReviewAggregateWhereInput = {
      approvedVersionId: { not: null },
      ...(input.visibility ? { visibilityState: input.visibility } : {}),
      ...(input.applicationState ? { applicationState: input.applicationState } : {}),
      ...(search ? { OR: [{ publicJobPosting: { is: { normalizedTitle: { contains: search } } } }, { company: { displayName: { contains: input.q!, mode: "insensitive" } } }, { approvedVersion: { submittedBy: { is: { name: { contains: input.q!, mode: "insensitive" } } } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.jobPostReviewAggregate.findMany({ where, skip: (input.page - 1) * input.perPage, take: input.perPage, orderBy: { updatedAt: "desc" }, include: { company: { select: { displayName: true } }, publicJobPosting: { select: { title: true, approvedAt: true, publishedAt: true } }, approvedVersion: { select: { submittedBy: { select: { name: true } }, decidedByAdmin: { select: { name: true } } } }, featuredPlacements: { where: { state: { in: ["SCHEDULED", "ACTIVE"] } }, select: { id: true }, take: 1 }, _count: { select: { enforcementTargets: true } } } }),
      prisma.jobPostReviewAggregate.count({ where }),
    ]);
    return { data: rows.filter((row) => !input.featured || row.featuredPlacements.length > 0).map((row) => ({ id: row.jobId, title: row.publicJobPosting?.title ?? "Unavailable job", company: row.company.displayName, recruiter: row.approvedVersion?.submittedBy?.name ?? null, approver: row.approvedVersion?.decidedByAdmin?.name ?? null, visibility: row.visibilityState, applicationState: row.applicationState, approvedAt: row.publicJobPosting?.approvedAt?.toISOString() ?? null, publishedAt: row.publicJobPosting?.publishedAt?.toISOString() ?? null, featured: row.featuredPlacements.length > 0, reportCount: row._count.enforcementTargets, version: row.version })), total };
  }

  async detail(authority: AdminAuthority, jobId: string) {
    await this.assertScope(authority, "JOB_POST_MODERATE");
    const row = await prisma.jobPostReviewAggregate.findUnique({ where: { jobId }, include: { company: { select: { id: true, displayName: true, verificationState: true } }, publicJobPosting: true, approvedVersion: { include: { submittedBy: { select: { id: true, name: true } }, decidedByAdmin: { select: { id: true, name: true } } } }, pendingVersion: { select: { id: true, sequence: true, submittedAt: true, state: true } }, correctionRequests: { orderBy: { createdAt: "desc" } }, featuredPlacements: { orderBy: { startsAt: "desc" } }, operationalHistory: { orderBy: { occurredAt: "desc" }, take: 100 }, enforcementTargets: { include: { enforcementAction: { include: { reportLinks: true } } } } } });
    if (!row) throw new Error("TARGET_UNAVAILABLE");
    return { ...row, id: row.jobId, version: row.version, reportSummary: { activeCount: row.enforcementTargets.reduce((count, target) => count + target.enforcementAction.reportLinks.length, 0) } };
  }

  async command(authority: AdminAuthority, jobId: string, raw: unknown, expectedVersion: number, idempotencyKey: string) {
    const command = jobManagementCommandSchema.parse(raw);
    await this.assertScope(authority, scopes[command.command]);
    return new PrismaAdminCommandRepository().execute({ actorUserId: authority.userId, actorSessionId: authority.sessionId, grantId: authority.grantId, commandKind: `JOB_POST_MANAGEMENT_${command.command}`, targetReference: jobId, idempotencyKey, normalizedBody: { jobId, expectedVersion, command } }, async (tx, correlationId) => {
      const row = await tx.jobPostReviewAggregate.findUnique({ where: { jobId }, include: { publicJobPosting: true, approvedVersion: true } });
      if (!row || !row.publicJobPosting || !row.approvedVersionId) throw new Error("TARGET_UNAVAILABLE");
      if (row.version !== expectedVersion) throw new AdminCommandConflict("STALE_CONFLICT", row.version);
      if (row.softDeletedAt && command.command !== "SOFT_DELETE") throw new Error("INVALID_STATE");
      const prior = stateOf(row);
      let visibility = row.visibilityState; let applicationState = row.applicationState;
      const now = new Date(); let reason = "reason" in command ? command.reason : null;
      const data: Prisma.JobPostReviewAggregateUpdateManyMutationInput = { version: { increment: 1 }, operationalVersion: { increment: 1 } };
      if (command.command === "HIDE") { visibility = "HIDDEN"; Object.assign(data, { visibilityState: visibility, hiddenAt: now, hiddenByUserId: authority.userId, hiddenReason: reason }); }
      if (command.command === "RESTORE") { visibility = "PUBLISHED"; Object.assign(data, { visibilityState: visibility, hiddenAt: null, hiddenByUserId: null, hiddenReason: null, archivedAt: null, archivedByUserId: null }); }
      if (command.command === "CLOSE_APPLICATIONS") { applicationState = "CLOSED"; Object.assign(data, { applicationState, applicationClosedAt: now, applicationClosedByUserId: authority.userId }); }
      if (command.command === "REOPEN_APPLICATIONS") { applicationState = "OPEN"; Object.assign(data, { applicationState, applicationClosedAt: null, applicationClosedByUserId: null }); }
      if (command.command === "ARCHIVE") { visibility = "ARCHIVED"; applicationState = "CLOSED"; Object.assign(data, { visibilityState: visibility, applicationState, archivedAt: now, archivedByUserId: authority.userId }); }
      if (command.command === "SOFT_DELETE" || (command.command === "ENFORCE" && command.type === "SOFT_DELETE_JOB")) { visibility = "HIDDEN"; applicationState = "CLOSED"; Object.assign(data, { visibilityState: visibility, applicationState, softDeletedAt: now, softDeletedByUserId: authority.userId, softDeleteReason: reason }); }
      if (command.command === "REQUEST_CHANGES" && command.hideImmediately) { visibility = "HIDDEN"; Object.assign(data, { visibilityState: visibility, hiddenAt: now, hiddenByUserId: authority.userId, hiddenReason: command.publicExplanation }); }
      if (command.command === "ENFORCE" && command.type === "HIDE_JOB") { visibility = "HIDDEN"; Object.assign(data, { visibilityState: visibility, hiddenAt: now, hiddenByUserId: authority.userId, hiddenReason: reason }); }
      if (command.command === "ENFORCE" && command.type === "CLOSE_APPLICATIONS") { applicationState = "CLOSED"; Object.assign(data, { applicationState, applicationClosedAt: now, applicationClosedByUserId: authority.userId }); }
      if (command.command === "ENFORCE" && command.type === "REQUEST_CHANGES") { visibility = "HIDDEN"; Object.assign(data, { visibilityState: visibility, hiddenAt: now, hiddenByUserId: authority.userId, hiddenReason: command.publicExplanation }); }
      const changed = await tx.jobPostReviewAggregate.updateMany({ where: { id: row.id, version: expectedVersion }, data });
      if (changed.count !== 1) throw new AdminCommandConflict("STALE_CONFLICT");
      if (command.command === "REQUEST_CHANGES") await tx.jobPostRevisionRequest.create({ data: { aggregateId: row.id, liveVersionId: row.approvedVersionId, requestedByAdminUserId: authority.userId, publicExplanation: command.publicExplanation, hideImmediately: command.hideImmediately } });
      if (command.command === "ENFORCE" && command.type === "REQUEST_CHANGES") await tx.jobPostRevisionRequest.create({ data: { aggregateId: row.id, liveVersionId: row.approvedVersionId, requestedByAdminUserId: authority.userId, publicExplanation: command.publicExplanation!, hideImmediately: true } });
      if (command.command === "FEATURE") {
        if (command.endsAt <= command.startsAt || visibility !== "PUBLISHED" || applicationState !== "OPEN") throw new Error("VALIDATION_FAILED");
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${command.placement}))`);
        const booked = await tx.jobPostFeaturedPlacement.count({ where: { placement: command.placement, state: { in: ["SCHEDULED", "ACTIVE"] }, startsAt: { lt: command.endsAt }, endsAt: { gt: command.startsAt } } });
        if (booked >= 6) throw new Error("FEATURE_CAPACITY_CONFLICT");
        await tx.jobPostFeaturedPlacement.create({ data: { aggregateId: row.id, placement: command.placement, priority: command.priority, startsAt: command.startsAt, endsAt: command.endsAt, state: command.startsAt <= now ? "ACTIVE" : "SCHEDULED", reason: command.reason, createdByAdminUserId: authority.userId } });
      }
      if (command.command === "UNFEATURE") await tx.jobPostFeaturedPlacement.updateMany({ where: { id: command.featureId, aggregateId: row.id, state: { in: ["SCHEDULED", "ACTIVE"] } }, data: { state: "CANCELLED", cancelledAt: now, cancelledByAdminUserId: authority.userId, version: { increment: 1 } } });
      if (command.command === "ENFORCE") {
        const reports = await tx.moderationReport.findMany({ where: { id: { in: command.reportIds }, jobReference: jobId, state: "PENDING_REVIEW" }, select: { id: true, version: true, state: true } });
        if (reports.length !== command.reportIds.length) throw new Error("REPORT_TARGET_UNAVAILABLE");
        const action = await tx.jobPostEnforcementAction.create({ data: { correlationId, type: command.type, actorAdminUserId: authority.userId, actorSessionId: authority.sessionId, reason: command.reason, publicExplanation: command.publicExplanation } });
        await tx.jobPostEnforcementTarget.create({ data: { enforcementActionId: action.id, aggregateId: row.id, targetType: "JOB", targetReference: jobId, priorState: prior, resultingState: { visibility, applicationState } } });
        await tx.moderationReportEnforcementLink.createMany({ data: reports.map((report) => ({ moderationReportId: report.id, enforcementActionId: action.id })) });
        for (const report of reports) {
          await tx.moderationReport.update({ where: { id: report.id }, data: { state: "RESOLVED", terminalAt: now, unresolvedKey: null, version: { increment: 1 } } });
          await tx.moderationReportHistory.create({ data: { reportId: report.id, actorAdminUserId: authority.userId, action: "enforced", priorState: report.state, resultingState: "RESOLVED", resultingVersion: report.version + 1, enforcementCorrelationId: correlationId, occurredAt: now } });
        }
      }
      const publicStatus = visibility === "PUBLISHED" ? applicationState === "OPEN" ? "ACTIVE" : "CLOSED" : "REMOVED";
      await tx.jobPosting.update({ where: { id: row.publicJobPostingId! }, data: { status: publicStatus, closedAt: applicationState === "CLOSED" ? now : null, removedAt: visibility === "PUBLISHED" ? null : now, version: { increment: 1 } } });
      const version = expectedVersion + 1;
      await tx.jobPostOperationalHistory.create({ data: { aggregateId: row.id, action: command.command, actorUserId: authority.userId, correlationId, priorState: prior, resultingState: { visibility, applicationState }, reason: command.command === "REQUEST_CHANGES" ? command.publicExplanation : command.command === "ENFORCE" && command.type === "REQUEST_CHANGES" ? command.publicExplanation : reason, version, occurredAt: now } });
      const auditAction = {
        HIDE: "job_post_management.hide", RESTORE: "job_post_management.restore", CLOSE_APPLICATIONS: "job_post_management.close_applications", REOPEN_APPLICATIONS: "job_post_management.reopen_applications", ARCHIVE: "job_post_management.archive", SOFT_DELETE: "job_post_management.soft_delete", REQUEST_CHANGES: "job_post_management.request_changes", FEATURE: "job_post_management.feature", UNFEATURE: "job_post_management.unfeature", ENFORCE: "job_post_management.enforce",
      } as const;
      await new PrismaAuditRepository(tx).append({ occurredAt: now, actorType: "user", actorUserId: authority.userId, actorSessionId: authority.sessionId, action: auditAction[command.command], targetType: "job_posting", targetId: jobId, result: "SUCCESS", correlationId, context: { targetVersion: version, priorState: JSON.stringify(prior), resultingState: JSON.stringify({ visibility, applicationState }), visibility, applicationState } });
      return { jobId, version, visibility, applicationState, status: "SUCCESS" as const };
    });
  }
}
