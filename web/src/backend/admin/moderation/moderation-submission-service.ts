import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  moderationSubmissionSchema,
  moderationPriority,
} from "@/shared/contracts/admin/moderation";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import { notifyActionableAdministrators } from "@/backend/notifications/admin-notification-fanout";
const acknowledgement = "Thanks. Your concern was received for review.";
type Actor = { userId: string; sessionId: string };
function unavailable() {
  return Object.assign(new Error("REPORT_TARGET_UNAVAILABLE"), { status: 404 });
}
export class ModerationSubmissionService {
  async submitRequest(request: Request, raw: unknown, now = new Date()) {
    const session = await requireSession(request.headers, now);
    if (!session) throw unavailable();
    return this.submitActor(
      { userId: session.userId, sessionId: session.sessionId },
      raw,
      now,
    );
  }
  async submitActor(actor: Actor, raw: unknown, now = new Date()) {
    const command = moderationSubmissionSchema.parse(raw);
    const account = await prisma.userAccount.findFirst({
      where: { id: actor.userId, state: "ACTIVE" },
      select: { id: true },
    });
    if (!account) throw unavailable();
    const relationship = await this.authorize(
      actor.userId,
      command.target,
      now,
    );
    if (!relationship) throw unavailable();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60_000);
    const [duplicate, count] = await Promise.all([
      prisma.moderationReport.findFirst({
        where: {
          reporterUserId: actor.userId,
          targetType: command.target.type,
          targetReference: command.target.reference,
          category: command.category,
          OR: [{ state: "PENDING_REVIEW" }, { createdAt: { gte: cutoff } }],
        },
      }),
      prisma.moderationReport.count({
        where: { reporterUserId: actor.userId, createdAt: { gte: cutoff } },
      }),
    ]);
    if (duplicate)
      return {
        created: false,
        received: true as const,
        duplicate: true,
        message: acknowledgement,
      };
    if (count >= 10) {
      const oldest = await prisma.moderationReport.findFirst({
        where: { reporterUserId: actor.userId, createdAt: { gte: cutoff } },
        orderBy: { createdAt: "asc" },
      });
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          ((oldest?.createdAt.getTime() ?? now.getTime()) +
            24 * 60 * 60_000 -
            now.getTime()) /
            1000,
        ),
      );
      throw Object.assign(new Error("RATE_LIMITED"), { retryAfterSeconds });
    }
    const unresolvedKey = createHash("sha256")
      .update(
        `${actor.userId}:${command.target.type}:${command.target.reference}:${command.category}`,
      )
      .digest("hex");
    try {
      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.moderationReport.create({
          data: {
            reporterUserId: actor.userId,
            targetType: command.target.type,
            targetReference: command.target.reference,
            companyReference: relationship.companyReference,
            jobReference: relationship.jobReference,
            applicationReference: relationship.applicationReference,
            qualifyingRelationship: relationship,
            category: command.category,
            normalizedDetail: command.detail,
            priority: moderationPriority(command.category),
            unresolvedKey,
          },
        });
        if (command.target.type === "JOB") {
          const reason = (
            {
              FRAUD_OR_IMPERSONATION: "FRAUD",
              MISLEADING_CONTENT: "MISLEADING",
              DISCRIMINATION_OR_HARASSMENT: "DISCRIMINATORY",
              ABUSE_OR_THREATS: "INAPPROPRIATE",
              SPAM_OR_DUPLICATE: "DUPLICATE",
              PRIVACY_OR_DATA_MISUSE: "INAPPROPRIATE",
              OTHER: "OTHER",
            } as const
          )[command.category];
          await tx.jobReport.create({
            data: {
              reporterUserId: actor.userId,
              jobPostingId: command.target.reference,
              reason,
              details: command.detail,
              unresolvedKey: `moderation:${created.id}`,
            },
          });
        }
        await createInAppNotification(tx, {
          recipientUserId: actor.userId,
          kind: "MODERATION_REPORT_RECEIVED",
          deduplicationKey: `moderation-report:${created.id}:received`,
          correlationId: created.id,
          occurredAt: now,
          contextType: "MODERATION_REPORT",
          contextId: created.id,
        });
        await notifyActionableAdministrators(tx, {
          kind: "MODERATION_REPORT_RECEIVED_ADMIN",
          eventKey: `${created.id}:received`,
          correlationId: created.id,
          occurredAt: now,
          contextType: "MODERATION_REPORT",
          contextId: created.id,
          state: "PENDING_REVIEW",
        });
        return created;
      });
      return {
        created: true,
        reportId: report.id,
        received: true as const,
        duplicate: false,
        message: acknowledgement,
      };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        return {
          created: false,
          received: true as const,
          duplicate: true,
          message: acknowledgement,
        };
      throw error;
    }
  }
  private async authorize(
    userId: string,
    target: {
      type: string;
      reference: string;
      companyReference?: string;
      jobReference?: string;
      applicationReference?: string;
    },
    now: Date,
  ) {
    if (target.type === "JOB") {
      const job = await prisma.jobPosting.findFirst({
        where: {
          id: target.reference,
          status: "ACTIVE",
          publishedAt: { lte: now },
        },
        select: { id: true, companyId: true },
      });
      return job
        ? {
            kind: "PUBLIC_JOB",
            companyReference: job.companyId,
            jobReference: job.id,
            applicationReference: null,
          }
        : null;
    }
    if (target.type === "COMPANY" || target.type === "MEMBERSHIP") {
      if (!target.jobReference) return null;
      const job = await prisma.jobPosting.findFirst({
        where: {
          id: target.jobReference,
          status: "ACTIVE",
          publishedAt: { lte: now },
        },
        select: { id: true, companyId: true },
      });
      if (!job) return null;
      if (target.type === "COMPANY" && target.reference !== job.companyId)
        return null;
      if (target.type === "MEMBERSHIP") {
        const membership = await prisma.companyMembership.findFirst({
          where: {
            id: target.reference,
            companyId: job.companyId,
            status: "ACTIVE",
          },
        });
        if (!membership) return null;
      }
      return {
        kind: "PUBLIC_JOB_RELATIONSHIP",
        companyReference: job.companyId,
        jobReference: job.id,
        applicationReference: null,
      };
    }
    if (target.type === "CANDIDATE") {
      if (!target.applicationReference) return null;
      const application = await prisma.jobApplication.findFirst({
        where: {
          id: target.applicationReference,
          candidateUserId: target.reference,
        },
        include: {
          jobPosting: { select: { companyId: true } },
          stageEvents: {
            where: { actorUserId: userId },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!application) return null;
      const membership = await prisma.companyMembership.findFirst({
        where: {
          userId,
          companyId: application.jobPosting.companyId,
          status: "ACTIVE",
        },
      });
      if (!membership) return null;
      const permitted =
        ["OWNER", "HR_MANAGER"].includes(membership.role) ||
        (["RECRUITER", "HIRING_MANAGER"].includes(membership.role) &&
          application.stageEvents.length > 0);
      return permitted
        ? {
            kind: "DIRECT_APPLICATION_AUTHORITY",
            companyReference: application.jobPosting.companyId,
            jobReference: application.jobPostingId,
            applicationReference: application.id,
            membershipReference: membership.id,
          }
        : null;
    }
    return null;
  }
}
