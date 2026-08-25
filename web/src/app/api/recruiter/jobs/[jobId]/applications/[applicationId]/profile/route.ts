import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaProfileQueryRepository } from "@/backend/repositories/profile/prisma-profile-query-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { projectVisibleProfile } from "@/backend/services/profile/profile-visibility-projection";
import { prisma } from "@/backend/database/prisma";
import { recruiterCandidateProfileSchema } from "@/shared/contracts/recruiter-candidate-profile";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  const { jobId, applicationId } = await context.params;
  const authorization = await new RecruiterApplicationAuthorization().authorizeApplication(current.userId, jobId, applicationId);
  if (!authorization.authorized || !authorization.canView) return NextResponse.json({ code: "NOT_FOUND", message: "Candidate profile is not available." }, { status: 404, headers: noStore });
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, jobPostingId: authorization.jobPostingId },
    select: { candidateUserId: true, profileSnapshot: true, profileSnapshotAccessDeniedAt: true, contactConsent: { select: { sharedAt: true, withdrawnAt: true } } },
  });
  if (!application) return NextResponse.json({ code: "NOT_FOUND", message: "Candidate profile is not available." }, { status: 404, headers: noStore });
  const snapshot = application.profileSnapshotAccessDeniedAt ? null : recruiterCandidateProfileSchema.shape.submittedProfile.unwrap().safeParse(application.profileSnapshot).data ?? null;
  const row = await new PrismaProfileQueryRepository().findOwned(application.candidateUserId);
  const liveProfile = row ? projectVisibleProfile({ userId: application.candidateUserId, displayName: row.candidate.user.name, image: row.candidate.user.image, profile: await new GetProfileAggregateService().execute(application.candidateUserId), audience: "recruiter" }) : null;
  await new PrismaAuditRepository().append({ occurredAt: new Date(), actorType: "user", actorUserId: current.userId, actorSessionId: current.sessionId, action: "recruiter.application_profile_viewed", targetType: "job_application", targetId: applicationId, result: "SUCCESS", correlationId: randomUUID(), context: { applicationState: "PROFILE_REVIEW" } });
  return NextResponse.json(recruiterCandidateProfileSchema.parse({ submittedProfile: snapshot, liveProfile, contactShared: Boolean(application.contactConsent?.sharedAt && !application.contactConsent.withdrawnAt), submittedProfileAvailable: Boolean(snapshot) }), { headers: noStore });
}
