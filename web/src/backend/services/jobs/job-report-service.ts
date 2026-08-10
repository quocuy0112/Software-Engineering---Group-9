import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { AuthenticationAuditEvent } from "@/backend/audit/events";
import type { JobReportRepositoryPort } from "@/backend/repositories/jobs/prisma-job-report-repository";
import type { RateLimitDecision } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";
import {
  jobReportInputSchema,
  type JobReportInput,
} from "@/shared/contracts/jobs/actions";
import type { CandidateActor } from "./job-types";
import { JobServiceError } from "./job-types";

type PublicActionTargetRepository = {
  findPublicActionTarget(jobId: string, now: Date): Promise<unknown | null>;
};
type RateLimiter = {
  consume(input: {
    scope: string;
    subject: string;
    limit: number;
    windowSeconds: number;
    now?: Date;
  }): Promise<RateLimitDecision>;
};
type AuditWriter = { append(event: AuthenticationAuditEvent): Promise<string> };
type DigestFactory = (
  actorId: string,
  jobId: string,
  reason: JobReportInput["reason"],
) => Promise<string>;

const neutralMessage = "Thanks. Your concern was received for review.";

function normalizeDetails(value: string | null) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .replace(
      /<(?:script|style|textarea|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|textarea|noscript)>/giu,
      " ",
    )
    .replace(/<[^>]*>/gu, " ")
    .replace(/[<>]/gu, " ")
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\S\n]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return normalized || null;
}

export class JobReportService {
  constructor(
    private readonly reports?: JobReportRepositoryPort,
    private readonly publicJobs?: PublicActionTargetRepository,
    private readonly limiter?: RateLimiter,
    private readonly audit?: AuditWriter,
    private readonly digestFactory?: DigestFactory,
  ) {}

  private async reportRepo() {
    return (
      this.reports ??
      new (
        await import("@/backend/repositories/jobs/prisma-job-report-repository")
      ).PrismaJobReportRepository()
    );
  }

  private async publicRepo() {
    return (
      this.publicJobs ??
      new (
        await import("@/backend/repositories/jobs/prisma-public-job-repository")
      ).PrismaPublicJobRepository()
    );
  }

  private async rateLimiter() {
    return (
      this.limiter ??
      new (
        await import("@/backend/repositories/rate-limit/prisma-rate-limit-repository")
      ).PrismaRateLimitRepository()
    );
  }

  private async auditWriter() {
    return (
      this.audit ??
      new (
        await import("@/backend/repositories/audit/prisma-audit-repository")
      ).PrismaAuditRepository()
    );
  }

  private async unresolvedDigest(
    actorId: string,
    jobId: string,
    reason: JobReportInput["reason"],
  ) {
    if (this.digestFactory) return this.digestFactory(actorId, jobId, reason);
    const secret = (await import("@/backend/env/runtime")).serverEnvironment
      .TOKEN_SECRET;
    return createHmac("sha256", secret)
      .update(`${actorId}:${jobId}:${reason}`, "utf8")
      .digest("hex");
  }

  async submit(
    actor: CandidateActor,
    jobId: string,
    raw: unknown,
    now = new Date(),
  ) {
    const initial = jobReportInputSchema.parse(raw);
    const command = jobReportInputSchema.parse({
      ...initial,
      details: normalizeDetails(initial.details),
    });
    const correlationId = randomUUID();
    if (!this.reports && !this.publicJobs && !this.limiter && !this.audit && !this.digestFactory) {
      const category = ({ FRAUD: "FRAUD_OR_IMPERSONATION", MISLEADING: "MISLEADING_CONTENT", DUPLICATE: "SPAM_OR_DUPLICATE", DISCRIMINATORY: "DISCRIMINATION_OR_HARASSMENT", INAPPROPRIATE: "ABUSE_OR_THREATS", OTHER: "OTHER" } as const)[command.reason];
      const result = await new (await import("@/backend/admin/moderation/moderation-submission-service")).ModerationSubmissionService().submitActor(actor, { target: { type: "JOB", reference: jobId }, category, detail: command.details ?? undefined }, now);
      return { created: result.created, outcome: { received: true as const, duplicate: result.duplicate, message: result.message } };
    }
    const decision = await (
      await this.rateLimiter()
    ).consume({
      ...rateLimitPolicies.jobReport,
      subject: actor.userId,
      now,
    });
    if (!decision.allowed) {
      await (
        await this.auditWriter()
      ).append({
        occurredAt: now,
        actorType: "user",
        actorUserId: actor.userId,
        actorSessionId: actor.sessionId,
        action: "job.report.denied",
        targetType: "job_posting",
        targetId: jobId,
        result: "DENIED",
        correlationId,
        context: { reason: "rate_limited" },
      });
      throw new JobServiceError(429, {
        code: "REPORT_RATE_LIMITED",
        message: "Please wait before reporting another job.",
        retryAfterSeconds: Math.max(1, decision.retryAfterSeconds),
      });
    }
    if (!(await (await this.publicRepo()).findPublicActionTarget(jobId, now))) {
      throw new JobServiceError(404, {
        code: "JOB_NOT_FOUND",
        message: "This job is not available on the public board.",
      });
    }
    const result = await (
      await this.reportRepo()
    ).submit({
      reporterUserId: actor.userId,
      sessionId: actor.sessionId,
      jobId,
      reason: command.reason,
      details: command.details,
      unresolvedKey: await this.unresolvedDigest(
        actor.userId,
        jobId,
        command.reason,
      ),
      occurredAt: now,
      correlationId,
    });
    return {
      created: result.created,
      outcome: {
        received: true as const,
        duplicate: !result.created,
        message: neutralMessage,
      },
    };
  }
}
