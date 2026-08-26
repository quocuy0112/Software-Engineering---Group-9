import "server-only";

import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { prisma } from "@/backend/database/prisma";
import { PrismaQualifiedViewRepository } from "@/backend/repositories/analytics/prisma-qualified-view-repository";
import { analyticsConfiguration } from "./analytics-config";
import { classifyJobPostingView, requestVisitorIdentity } from "./qualified-view-policy";

export class QualifiedViewService {
  constructor(
    private readonly repository = new PrismaQualifiedViewRepository(),
    private readonly recruiterAuthorization = new RecruiterApplicationAuthorization(),
  ) {}

  async admit(input: {
    jobPostingId: string;
    companyId?: string;
    headers: Headers;
    actorUserId?: string | null;
    occurredAt?: Date;
  }) {
    const occurredAt = input.occurredAt ?? new Date();
    const posting = input.companyId
      ? { companyId: input.companyId }
      : await prisma.jobPosting.findUnique({
          where: { id: input.jobPostingId },
          select: { companyId: true },
        });
    if (!posting) return false;
    let isOwnerPreview = false;
    if (input.actorUserId) {
      const authorized = await this.recruiterAuthorization.authorizeJob(
        input.actorUserId,
        input.jobPostingId,
      );
      isOwnerPreview =
        authorized.authorized && authorized.companyId === posting.companyId;
    }
    const classified = classifyJobPostingView({
      postingId: input.jobPostingId,
      visitorIdentity: requestVisitorIdentity(input.headers, input.actorUserId),
      occurredAt,
      userAgent: input.headers.get("user-agent"),
      isOwnerPreview,
    });
    if (classified.qualification !== "QUALIFIED") return false;
    return this.repository.admit({
      jobPostingId: input.jobPostingId,
      companyId: posting.companyId,
      occurredAt,
      platformDay: classified.platformDay,
      visitorDayDigest: classified.visitorDayDigest,
      digestVersion: classified.digestVersion,
      qualificationPolicyVersion: analyticsConfiguration().qualificationPolicyVersion,
    });
  }
}
