import "server-only";
import { prisma } from "@/backend/database/prisma";
import type {
  AuthorizedMessagingContext,
  MessagingEligibilityProvider,
} from "@/backend/messaging/ports/eligibility-provider";

const recruitingRoles = [
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
] as const;

export class ApplicationMessagingEligibility
  implements MessagingEligibilityProvider
{
  constructor(private readonly db: typeof prisma = prisma) {}

  async hasEligibleRelationship(userA: string, userB: string) {
    if (userA === userB) return false;
    const eligible = (candidateUserId: string, recruiterUserId: string) =>
      this.db.jobApplication.findFirst({
        where: {
          candidateUserId,
          candidate: { user: { state: "ACTIVE" } },
          jobPosting: {
            company: {
              memberships: {
                some: {
                  userId: recruiterUserId,
                  status: "ACTIVE",
                  role: { in: [...recruitingRoles] },
                  user: { state: "ACTIVE" },
                },
              },
            },
          },
        },
        select: { id: true },
      });
    const [aCandidate, bCandidate] = await Promise.all([
      eligible(userA, userB),
      eligible(userB, userA),
    ]);
    return Boolean(aCandidate || bCandidate);
  }

  async authorizeContext(input: {
    userA: string;
    userB: string;
    reference: string;
  }): Promise<AuthorizedMessagingContext | null> {
    const application = await this.db.jobApplication.findFirst({
      where: {
        id: input.reference,
        candidateUserId: { in: [input.userA, input.userB] },
        candidate: { user: { state: "ACTIVE" } },
      },
      select: {
        id: true,
        candidateUserId: true,
        jobPosting: {
          select: {
            title: true,
            companyId: true,
            company: { select: { displayName: true } },
          },
        },
      },
    });
    if (!application) return null;
    const recruiterUserId =
      application.candidateUserId === input.userA ? input.userB : input.userA;
    const membership = await this.db.companyMembership.findFirst({
      where: {
        companyId: application.jobPosting.companyId,
        userId: recruiterUserId,
        status: "ACTIVE",
        role: { in: [...recruitingRoles] },
        user: { state: "ACTIVE" },
      },
      select: { id: true },
    });
    if (!membership) return null;
    return {
      type: "APPLICATION",
      reference: application.id,
      applicationId: application.id,
      companyId: application.jobPosting.companyId,
      label: application.jobPosting.title,
      companyName: application.jobPosting.company.displayName,
      jobTitle: application.jobPosting.title,
    };
  }
}
