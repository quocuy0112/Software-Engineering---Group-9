import type { Prisma } from "@/backend/generated/prisma/client";
import type { JobManagementCommand } from "@/shared/contracts/admin/job-post-management";

type EnforcementCommand = Extract<JobManagementCommand, { command: "ENFORCE" }>;
type EnforcementTarget = {
  id: string;
  companyId: string;
  approvedVersion?: { submittedByUserId: string | null } | null;
};

/** Persists immutable report-to-enforcement evidence in the caller transaction. */
export class JobPostEnforcementService {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async record(input: {
    command: EnforcementCommand;
    aggregate: EnforcementTarget;
    jobId: string;
    actorUserId: string;
    actorSessionId: string | null;
    correlationId: string;
    priorState: object;
    resultingState: object;
    now: Date;
  }) {
    const reports = await this.tx.moderationReport.findMany({
      where: {
        id: { in: input.command.reportIds },
        jobReference: input.jobId,
        state: "PENDING_REVIEW",
      },
      select: { id: true, version: true, state: true },
    });
    if (reports.length !== input.command.reportIds.length)
      throw new Error("REPORT_TARGET_UNAVAILABLE");
    const action = await this.tx.jobPostEnforcementAction.create({
      data: {
        correlationId: input.correlationId,
        type: input.command.type,
        actorAdminUserId: input.actorUserId,
        actorSessionId: input.actorSessionId,
        reason: input.command.reason,
        publicExplanation: input.command.publicExplanation,
      },
    });
    await this.tx.jobPostEnforcementTarget.create({
      data: {
        enforcementActionId: action.id,
        aggregateId: input.aggregate.id,
        targetType: "JOB",
        targetReference: input.jobId,
        priorState: input.priorState,
        resultingState: input.resultingState,
      },
    });
    if (input.command.type === "SUSPEND_COMPANY") {
      const company = await this.tx.company.findUnique({
        where: { id: input.aggregate.companyId },
        select: { verificationState: true, verifiedAt: true },
      });
      if (!company) throw new Error("TARGET_UNAVAILABLE");
      await this.tx.company.update({
        where: { id: input.aggregate.companyId },
        data: {
          verificationState: "INACTIVE",
          verificationInactiveAt: input.now,
          verifiedAt: null,
        },
      });
      await this.tx.jobPostEnforcementTarget.create({
        data: {
          enforcementActionId: action.id,
          targetType: "COMPANY",
          targetReference: input.aggregate.companyId,
          priorState: {
            verificationState: company.verificationState,
            verifiedAt: company.verifiedAt?.toISOString() ?? null,
          },
          resultingState: { verificationState: "INACTIVE" },
        },
      });
    }
    if (input.command.type === "SUSPEND_RECRUITER") {
      const recruiterId = input.aggregate.approvedVersion?.submittedByUserId;
      if (!recruiterId) throw new Error("TARGET_UNAVAILABLE");
      const suspended = await this.tx.companyMembership.updateMany({
        where: {
          companyId: input.aggregate.companyId,
          userId: recruiterId,
          status: "ACTIVE",
        },
        data: { status: "SUSPENDED", stateChangedAt: input.now },
      });
      if (suspended.count !== 1) throw new Error("TARGET_UNAVAILABLE");
      await this.tx.jobPostEnforcementTarget.create({
        data: {
          enforcementActionId: action.id,
          targetType: "RECRUITER",
          targetReference: recruiterId,
          priorState: { membershipState: "ACTIVE" },
          resultingState: { membershipState: "SUSPENDED" },
        },
      });
    }
    await this.tx.moderationReportEnforcementLink.createMany({
      data: reports.map((report) => ({
        moderationReportId: report.id,
        enforcementActionId: action.id,
      })),
    });
    for (const report of reports) {
      await this.tx.moderationReport.update({
        where: { id: report.id },
        data: {
          state: "RESOLVED",
          terminalAt: input.now,
          unresolvedKey: null,
          version: { increment: 1 },
        },
      });
      await this.tx.moderationReportHistory.create({
        data: {
          reportId: report.id,
          actorAdminUserId: input.actorUserId,
          action: "enforced",
          priorState: report.state,
          resultingState: "RESOLVED",
          resultingVersion: report.version + 1,
          enforcementCorrelationId: input.correlationId,
          occurredAt: input.now,
        },
      });
    }
    return action;
  }
}
