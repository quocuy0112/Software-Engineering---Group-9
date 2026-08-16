import "server-only";
import {
  Prisma,
  type PlatformAdministratorScope,
} from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import {
  findManagedJobPostForCommand,
  reserveManagedJobFeaturePlacement,
  syncManagedJobPublicProjection,
} from "@/backend/repositories/jobs/prisma-job-post-management-repository";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  jobManagementCommandSchema,
  jobManagementListQuerySchema,
} from "@/shared/contracts/admin/job-post-management";
import {
  assertJobPostManagementTransition,
  jobPostManagementScope,
} from "./job-post-management-policy";
import { emitJobPostManagementOperation } from "./job-post-management-operations";

function stateOf(row: {
  visibilityState: string;
  applicationState: string;
  softDeletedAt: Date | null;
}) {
  return {
    visibility: row.visibilityState,
    applicationState: row.applicationState,
    softDeleted: Boolean(row.softDeletedAt),
  };
}

export class JobPostManagementService {
  async assertScope(
    authority: AdminAuthority,
    scope: PlatformAdministratorScope,
    tx = prisma,
  ) {
    const grant = await tx.platformAdministratorGrant.findFirst({
      where: {
        id: authority.grantId,
        userId: authority.userId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        scopes: { some: { scope } },
      },
      select: { id: true },
    });
    if (!grant) throw new Error("ACTION_BLOCKED");
  }

  async list(authority: AdminAuthority, query: unknown) {
    await this.assertScope(authority, "JOB_POST_MODERATE");
    const input = jobManagementListQuerySchema.parse(query);
    const search = input.q?.toLowerCase();
    const reportGroups =
      input.reportState === "ANY" ||
      (!input.reportState && !input.minimumReports)
        ? []
        : await prisma.moderationReport.groupBy({
            by: ["jobReference"],
            where: { jobReference: { not: null }, state: "PENDING_REVIEW" },
            _count: { _all: true },
          });
    const matchingReportJobIds = reportGroups
      .filter((row) =>
        input.minimumReports ? row._count._all >= input.minimumReports : true,
      )
      .map((row) => row.jobReference)
      .filter((jobId): jobId is string => Boolean(jobId));
    const where: Prisma.JobPostReviewAggregateWhereInput = {
      approvedVersionId: { not: null },
      ...(input.visibility ? { visibilityState: input.visibility } : {}),
      ...(input.applicationState
        ? { applicationState: input.applicationState }
        : {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.featured
        ? {
            featuredPlacements: {
              some: { state: { in: ["SCHEDULED", "ACTIVE"] } },
            },
          }
        : {}),
      ...(input.reportState === "REPORTED" || input.minimumReports
        ? { jobId: { in: matchingReportJobIds } }
        : input.reportState === "UNREPORTED"
          ? {
              jobId: {
                notIn: reportGroups
                  .map((row) => row.jobReference)
                  .filter((jobId): jobId is string => Boolean(jobId)),
              },
            }
          : {}),
      AND: [
        ...(input.recruiterId
          ? [
              {
                approvedVersion: {
                  is: { submittedByUserId: input.recruiterId },
                },
              },
            ]
          : []),
        ...(input.approverId
          ? [
              {
                approvedVersion: {
                  is: { decidedByAdminUserId: input.approverId },
                },
              },
            ]
          : []),
        ...(input.approvedFrom || input.approvedTo
          ? [
              {
                publicJobPosting: {
                  is: {
                    approvedAt: {
                      ...(input.approvedFrom
                        ? { gte: input.approvedFrom }
                        : {}),
                      ...(input.approvedTo ? { lte: input.approvedTo } : {}),
                    },
                  },
                },
              },
            ]
          : []),
        ...(input.publishedFrom || input.publishedTo
          ? [
              {
                publicJobPosting: {
                  is: {
                    publishedAt: {
                      ...(input.publishedFrom
                        ? { gte: input.publishedFrom }
                        : {}),
                      ...(input.publishedTo ? { lte: input.publishedTo } : {}),
                    },
                  },
                },
              },
            ]
          : []),
      ],
      ...(search
        ? {
            OR: [
              {
                publicJobPosting: {
                  is: { normalizedTitle: { contains: search } },
                },
              },
              {
                company: {
                  displayName: { contains: input.q!, mode: "insensitive" },
                },
              },
              {
                approvedVersion: {
                  submittedBy: {
                    is: { name: { contains: input.q!, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.jobPostReviewAggregate.findMany({
        where,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: { updatedAt: "desc" },
        include: {
          company: { select: { displayName: true } },
          publicJobPosting: {
            select: { title: true, approvedAt: true, publishedAt: true },
          },
          approvedVersion: {
            select: {
              submittedBy: { select: { name: true } },
              decidedByAdmin: { select: { name: true } },
            },
          },
          featuredPlacements: {
            where: { state: { in: ["SCHEDULED", "ACTIVE"] } },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.jobPostReviewAggregate.count({ where }),
    ]);
    const reportRows = await prisma.moderationReport.groupBy({
      by: ["jobReference"],
      where: {
        jobReference: { in: rows.map((row) => row.jobId) },
        state: "PENDING_REVIEW",
      },
      _count: { _all: true },
    });
    const reportCount = new Map(
      reportRows.map((row) => [row.jobReference, row._count._all]),
    );
    const data = rows.map((row) => ({
      id: row.jobId,
      title: row.publicJobPosting?.title ?? "Unavailable job",
      company: row.company.displayName,
      recruiter: row.approvedVersion?.submittedBy?.name ?? null,
      approver: row.approvedVersion?.decidedByAdmin?.name ?? null,
      visibility: row.visibilityState,
      applicationState: row.applicationState,
      approvedAt: row.publicJobPosting?.approvedAt?.toISOString() ?? null,
      publishedAt: row.publicJobPosting?.publishedAt?.toISOString() ?? null,
      featured: row.featuredPlacements.length > 0,
      reportCount: reportCount.get(row.jobId) ?? 0,
      version: row.version,
    }));
    return { data, total };
  }

  async detail(authority: AdminAuthority, jobId: string) {
    await this.assertScope(authority, "JOB_POST_MODERATE");
    const row = await prisma.jobPostReviewAggregate.findUnique({
      where: { jobId },
      include: {
        company: {
          select: { id: true, displayName: true, verificationState: true },
        },
        publicJobPosting: true,
        approvedVersion: {
          include: {
            submittedBy: { select: { id: true, name: true } },
            decidedByAdmin: { select: { id: true, name: true } },
          },
        },
        pendingVersion: {
          select: { id: true, sequence: true, submittedAt: true, state: true },
        },
        correctionRequests: { orderBy: { createdAt: "desc" } },
        featuredPlacements: { orderBy: { startsAt: "desc" } },
        operationalHistory: { orderBy: { occurredAt: "desc" }, take: 100 },
        enforcementTargets: {
          include: { enforcementAction: { include: { reportLinks: true } } },
        },
      },
    });
    if (!row) throw new Error("TARGET_UNAVAILABLE");
    const reports = await prisma.moderationReport.findMany({
      where: { jobReference: jobId, state: "PENDING_REVIEW" },
      select: {
        id: true,
        reporterUserId: true,
        priority: true,
        category: true,
        createdAt: true,
      },
    });
    const priorities = { CRITICAL: 3, HIGH: 2, NORMAL: 1 } as const;
    const highestPriority = reports.reduce<keyof typeof priorities | null>(
      (highest, report) =>
        !highest || priorities[report.priority] > priorities[highest]
          ? report.priority
          : highest,
      null,
    );
    return {
      ...row,
      id: row.jobId,
      version: row.version,
      reportSummary: {
        activeCount: reports.length,
        distinctReporterCount: new Set(
          reports.map((report) => report.reporterUserId),
        ).size,
        highestPriority,
      },
      reports: reports.map((report) => ({
        id: report.id,
        priority: report.priority,
        category: report.category,
        createdAt: report.createdAt,
      })),
    };
  }

  async command(
    authority: AdminAuthority,
    jobId: string,
    raw: unknown,
    expectedVersion: number,
    idempotencyKey: string,
  ) {
    const command = jobManagementCommandSchema.parse(raw);
    await this.assertScope(authority, jobPostManagementScope[command.command]);
    const startedAt = Date.now();
    try {
      const result = await new PrismaAdminCommandRepository().execute(
        {
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          grantId: authority.grantId,
          commandKind: `JOB_POST_MANAGEMENT_${command.command}`,
          targetReference: jobId,
          idempotencyKey,
          normalizedBody: { jobId, expectedVersion, command },
        },
        async (tx, correlationId) => {
          const row = await findManagedJobPostForCommand(tx, jobId);
          if (!row || !row.publicJobPosting || !row.approvedVersionId)
            throw new Error("TARGET_UNAVAILABLE");
          if (row.version !== expectedVersion)
            throw new AdminCommandConflict("STALE_CONFLICT", row.version);
          assertJobPostManagementTransition(
            command,
            {
              visibility: row.visibilityState,
              applicationState: row.applicationState,
              softDeleted: Boolean(row.softDeletedAt),
              applicationDeadline: row.publicJobPosting.applicationDeadline,
            },
            new Date(),
          );
          const prior = stateOf(row);
          let visibility = row.visibilityState;
          let applicationState = row.applicationState;
          const now = new Date();
          const reason = "reason" in command ? command.reason : null;
          const data: Prisma.JobPostReviewAggregateUpdateManyMutationInput = {
            version: { increment: 1 },
            operationalVersion: { increment: 1 },
          };
          if (command.command === "HIDE") {
            visibility = "HIDDEN";
            Object.assign(data, {
              visibilityState: visibility,
              hiddenAt: now,
              hiddenByUserId: authority.userId,
              hiddenReason: reason,
            });
          }
          if (command.command === "RESTORE") {
            visibility = "PUBLISHED";
            Object.assign(data, {
              visibilityState: visibility,
              hiddenAt: null,
              hiddenByUserId: null,
              hiddenReason: null,
              archivedAt: null,
              archivedByUserId: null,
            });
          }
          if (command.command === "CLOSE_APPLICATIONS") {
            applicationState = "CLOSED";
            Object.assign(data, {
              applicationState,
              applicationClosedAt: now,
              applicationClosedByUserId: authority.userId,
            });
          }
          if (command.command === "REOPEN_APPLICATIONS") {
            applicationState = "OPEN";
            Object.assign(data, {
              applicationState,
              applicationClosedAt: null,
              applicationClosedByUserId: null,
            });
          }
          if (command.command === "ARCHIVE") {
            visibility = "ARCHIVED";
            applicationState = "CLOSED";
            Object.assign(data, {
              visibilityState: visibility,
              applicationState,
              archivedAt: now,
              archivedByUserId: authority.userId,
            });
          }
          if (
            command.command === "SOFT_DELETE" ||
            (command.command === "ENFORCE" &&
              command.type === "SOFT_DELETE_JOB")
          ) {
            visibility = "HIDDEN";
            applicationState = "CLOSED";
            Object.assign(data, {
              visibilityState: visibility,
              applicationState,
              softDeletedAt: now,
              softDeletedByUserId: authority.userId,
              softDeleteReason: reason,
            });
          }
          if (
            command.command === "REQUEST_CHANGES" &&
            command.hideImmediately
          ) {
            visibility = "HIDDEN";
            Object.assign(data, {
              visibilityState: visibility,
              hiddenAt: now,
              hiddenByUserId: authority.userId,
              hiddenReason: command.publicExplanation,
            });
          }
          if (command.command === "ENFORCE" && command.type === "HIDE_JOB") {
            visibility = "HIDDEN";
            Object.assign(data, {
              visibilityState: visibility,
              hiddenAt: now,
              hiddenByUserId: authority.userId,
              hiddenReason: reason,
            });
          }
          if (
            command.command === "ENFORCE" &&
            command.type === "CLOSE_APPLICATIONS"
          ) {
            applicationState = "CLOSED";
            Object.assign(data, {
              applicationState,
              applicationClosedAt: now,
              applicationClosedByUserId: authority.userId,
            });
          }
          if (
            command.command === "ENFORCE" &&
            command.type === "REQUEST_CHANGES"
          ) {
            visibility = "HIDDEN";
            Object.assign(data, {
              visibilityState: visibility,
              hiddenAt: now,
              hiddenByUserId: authority.userId,
              hiddenReason: command.publicExplanation,
            });
          }
          const changed = await tx.jobPostReviewAggregate.updateMany({
            where: { id: row.id, version: expectedVersion },
            data,
          });
          if (changed.count !== 1)
            throw new AdminCommandConflict("STALE_CONFLICT");
          if (
            command.command === "REQUEST_CHANGES" ||
            (command.command === "ENFORCE" &&
              command.type === "REQUEST_CHANGES")
          ) {
            const existingCorrection = await tx.jobPostRevisionRequest.count({
              where: { aggregateId: row.id, state: "OPEN" },
            });
            if (existingCorrection) throw new Error("CORRECTION_REQUEST_OPEN");
            await tx.jobPostRevisionRequest.create({
              data: {
                aggregateId: row.id,
                liveVersionId: row.approvedVersionId,
                requestedByAdminUserId: authority.userId,
                publicExplanation:
                  command.command === "REQUEST_CHANGES"
                    ? command.publicExplanation
                    : command.publicExplanation!,
                hideImmediately:
                  command.command === "REQUEST_CHANGES"
                    ? command.hideImmediately
                    : true,
              },
            });
          }
          if (
            command.command === "FEATURE" ||
            command.command === "AMEND_FEATURE"
          ) {
            if (
              command.endsAt <= command.startsAt ||
              visibility !== "PUBLISHED" ||
              applicationState !== "OPEN"
            )
              throw new Error("VALIDATION_FAILED");
            await reserveManagedJobFeaturePlacement(tx, {
              aggregateId: row.id,
              ...(command.command === "AMEND_FEATURE"
                ? { featureId: command.featureId }
                : {}),
              placement: command.placement,
              startsAt: command.startsAt,
              endsAt: command.endsAt,
              priority: command.priority,
              reason: command.reason,
              createdByAdminUserId: authority.userId,
              now,
            });
          }
          if (command.command === "UNFEATURE")
            await tx.jobPostFeaturedPlacement.updateMany({
              where: {
                id: command.featureId,
                aggregateId: row.id,
                state: { in: ["SCHEDULED", "ACTIVE"] },
              },
              data: {
                state: "CANCELLED",
                cancelledAt: now,
                cancelledByAdminUserId: authority.userId,
                version: { increment: 1 },
              },
            });
          if (command.command === "ENFORCE") {
            const reports = await tx.moderationReport.findMany({
              where: {
                id: { in: command.reportIds },
                jobReference: jobId,
                state: "PENDING_REVIEW",
              },
              select: {
                id: true,
                version: true,
                state: true,
                companyReference: true,
              },
            });
            if (reports.length !== command.reportIds.length)
              throw new Error("REPORT_TARGET_UNAVAILABLE");
            const action = await tx.jobPostEnforcementAction.create({
              data: {
                correlationId,
                type: command.type,
                actorAdminUserId: authority.userId,
                actorSessionId: authority.sessionId,
                reason: command.reason,
                publicExplanation: command.publicExplanation,
              },
            });
            await tx.jobPostEnforcementTarget.create({
              data: {
                enforcementActionId: action.id,
                aggregateId: row.id,
                targetType: "JOB",
                targetReference: jobId,
                priorState: prior,
                resultingState: { visibility, applicationState },
              },
            });
            if (command.type === "SUSPEND_COMPANY") {
              const company = await tx.company.findUnique({
                where: { id: row.companyId },
                select: { verificationState: true, verifiedAt: true },
              });
              if (!company) throw new Error("TARGET_UNAVAILABLE");
              await tx.company.update({
                where: { id: row.companyId },
                data: {
                  verificationState: "INACTIVE",
                  verificationInactiveAt: now,
                  verifiedAt: null,
                },
              });
              await tx.jobPostEnforcementTarget.create({
                data: {
                  enforcementActionId: action.id,
                  targetType: "COMPANY",
                  targetReference: row.companyId,
                  priorState: {
                    verificationState: company.verificationState,
                    verifiedAt: company.verifiedAt?.toISOString() ?? null,
                  },
                  resultingState: { verificationState: "INACTIVE" },
                },
              });
            }
            if (command.type === "SUSPEND_RECRUITER") {
              const recruiterId = row.approvedVersion?.submittedByUserId;
              if (!recruiterId) throw new Error("TARGET_UNAVAILABLE");
              const suspended = await tx.companyMembership.updateMany({
                where: {
                  companyId: row.companyId,
                  userId: recruiterId,
                  status: "ACTIVE",
                },
                data: { status: "SUSPENDED", stateChangedAt: now },
              });
              if (suspended.count !== 1) throw new Error("TARGET_UNAVAILABLE");
              await tx.jobPostEnforcementTarget.create({
                data: {
                  enforcementActionId: action.id,
                  targetType: "RECRUITER",
                  targetReference: recruiterId,
                  priorState: { membershipState: "ACTIVE" },
                  resultingState: { membershipState: "SUSPENDED" },
                },
              });
            }
            await tx.moderationReportEnforcementLink.createMany({
              data: reports.map((report) => ({
                moderationReportId: report.id,
                enforcementActionId: action.id,
              })),
            });
            for (const report of reports) {
              await tx.moderationReport.update({
                where: { id: report.id },
                data: {
                  state: "RESOLVED",
                  terminalAt: now,
                  unresolvedKey: null,
                  version: { increment: 1 },
                },
              });
              await tx.moderationReportHistory.create({
                data: {
                  reportId: report.id,
                  actorAdminUserId: authority.userId,
                  action: "enforced",
                  priorState: report.state,
                  resultingState: "RESOLVED",
                  resultingVersion: report.version + 1,
                  enforcementCorrelationId: correlationId,
                  occurredAt: now,
                },
              });
            }
          }
          await syncManagedJobPublicProjection(tx, {
            publicJobPostingId: row.publicJobPosting.id,
            visibility,
            applicationState,
            now,
          });
          const version = expectedVersion + 1;
          await tx.jobPostOperationalHistory.create({
            data: {
              aggregateId: row.id,
              action: command.command,
              actorUserId: authority.userId,
              correlationId,
              priorState: prior,
              resultingState: { visibility, applicationState },
              reason:
                command.command === "REQUEST_CHANGES"
                  ? command.publicExplanation
                  : command.command === "ENFORCE" &&
                      command.type === "REQUEST_CHANGES"
                    ? command.publicExplanation
                    : reason,
              version,
              occurredAt: now,
            },
          });
          const auditAction = {
            HIDE: "job_post_management.hide",
            RESTORE: "job_post_management.restore",
            CLOSE_APPLICATIONS: "job_post_management.close_applications",
            REOPEN_APPLICATIONS: "job_post_management.reopen_applications",
            ARCHIVE: "job_post_management.archive",
            SOFT_DELETE: "job_post_management.soft_delete",
            REQUEST_CHANGES: "job_post_management.request_changes",
            FEATURE: "job_post_management.feature",
            AMEND_FEATURE: "job_post_management.feature",
            UNFEATURE: "job_post_management.unfeature",
            ENFORCE: "job_post_management.enforce",
          } as const;
          await new PrismaAuditRepository(tx).append({
            occurredAt: now,
            actorType: "user",
            actorUserId: authority.userId,
            actorSessionId: authority.sessionId,
            action: auditAction[command.command],
            targetType: "job_posting",
            targetId: jobId,
            result: "SUCCESS",
            correlationId,
            context: {
              targetVersion: version,
              priorState: JSON.stringify(prior),
              resultingState: JSON.stringify({ visibility, applicationState }),
              visibility,
              applicationState,
            },
          });
          return {
            jobId,
            version,
            visibility,
            applicationState,
            status: "SUCCESS" as const,
          };
        },
      );
      emitJobPostManagementOperation({
        operation: command.command.toLowerCase(),
        outcome: "success",
        correlationId: idempotencyKey,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      emitJobPostManagementOperation({
        operation: command.command.toLowerCase(),
        outcome: "failure",
        correlationId: idempotencyKey,
        durationMs: Date.now() - startedAt,
        affectedCount: 0,
      });
      throw error;
    }
  }
}
