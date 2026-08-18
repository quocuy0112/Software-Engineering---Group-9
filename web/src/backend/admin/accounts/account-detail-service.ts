import "server-only";
import { PrismaAccountDirectoryRepository } from "@/backend/repositories/admin/prisma-account-directory-repository";
import {
  accountDetailSchema,
  accountDirectoryItemSchema,
  candidateActivityCountsSchema,
  recruiterActivityCountsSchema,
} from "@/shared/contracts/admin/resources";

export class AccountDetailService {
  constructor(
    private readonly repository = new PrismaAccountDirectoryRepository(),
  ) {}

  async get(accountId: string) {
    const result = await this.repository.detail(accountId);
    if (!result) return null;
    const recruiter = result.account.recruiterCompanyIds.length > 0;
    const candidateActivity = result.aggregates.candidateUnavailable
      ? { kind: "CANDIDATE" as const, unavailable: true as const }
      : {
          kind: "CANDIDATE" as const,
          ...(result.aggregates.candidate?.get(result.account.id) ?? {
            cvCount: 0,
            applicationCount: 0,
          }),
        };
    const recruiterActivity = recruiter
      ? result.aggregates.recruiterUnavailable
        ? { kind: "RECRUITER" as const, unavailable: true as const }
        : {
            kind: "RECRUITER" as const,
            ...(result.aggregates.recruiter?.get(result.account.id) ?? {
              active: 0,
              pendingReview: 0,
              rejected: 0,
              draft: 0,
              closed: 0,
            }),
          }
      : null;
    const account = accountDirectoryItemSchema.parse({
      id: result.account.id,
      accountReference: result.account.id,
      displayName: result.account.name,
      maskedEmail: result.account.maskedEmail,
      registeredAt: result.account.createdAt.toISOString(),
      type: recruiter ? "RECRUITER" : "CANDIDATE",
      status: result.account.state,
      version: result.account.version,
      hasCandidateIdentity: result.account.isCandidate,
      activeMembershipCount: result.account.recruiterCompanyIds.length,
      hasActiveAdministratorGrant: result.protectedAdministrator,
      counts: recruiter ? recruiterActivity : candidateActivity,
    });
    return accountDetailSchema.parse({
      account,
      candidateActivity: candidateActivitySchema(candidateActivity),
      recruiterActivity: recruiterActivity
        ? recruiterActivitySchema(recruiterActivity)
        : null,
      authorities: result.authorities,
      approvedVerificationEvidence: result.approvedVerificationEvidence,
      moderation: {
        canSuspend:
          result.account.state === "ACTIVE" && !result.protectedAdministrator,
        canRestore:
          result.account.state === "SUSPENDED" &&
          !result.protectedAdministrator,
        protectedAdministrator: result.protectedAdministrator,
        reasonCode: result.protectedAdministrator
          ? "PROTECTED_ADMINISTRATOR"
          : result.account.state === "ACTIVE"
            ? "NOT_SUSPENDED"
            : "NOT_ACTIVE",
      },
      history: result.history,
      calculatedAt: new Date().toISOString(),
    });
  }
}

function candidateActivitySchema(value: unknown) {
  return candidateActivityCountsSchema.parse(value);
}

function recruiterActivitySchema(value: unknown) {
  return recruiterActivityCountsSchema.parse(value);
}
