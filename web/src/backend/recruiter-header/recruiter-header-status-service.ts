import "server-only";

import {
  EMPLOYER_VERIFICATION_HREF,
  recruiterHeaderStatusSchema,
  type RecruiterHeaderStatus,
} from "@/shared/contracts/recruiter-header-status";
import { configuredOrigins } from "@/backend/admin/origins";
import type { RecruiterHeaderStatusRepositoryPort } from "./recruiter-header-status-repository";

export class RecruiterHeaderStatusService {
  constructor(
    private readonly repository: RecruiterHeaderStatusRepositoryPort,
    private readonly origins = configuredOrigins(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async resolveForUser(userId: string): Promise<RecruiterHeaderStatus> {
    const [hasQualifyingMembership, latestRequestState] = await Promise.all([
      this.repository.hasQualifyingMembership(userId),
      this.repository.findLatestVerificationState(userId),
    ]);
    const observedAt = this.clock().toISOString();
    if (hasQualifyingMembership) {
      return recruiterHeaderStatusSchema.parse({
        state: "APPROVED",
        destinationKind: "RECRUITER_WORKSPACE",
        href: this.origins.recruiter,
        observedAt,
      });
    }
    if (
      latestRequestState === "PENDING_CHECKS" ||
      latestRequestState === "PENDING_REVIEW" ||
      latestRequestState === "CHANGES_REQUESTED" ||
      latestRequestState === "RESUBMITTED"
    ) {
      return {
        state: "PENDING_REVIEW",
        destinationKind: "NONE",
        href: null,
        observedAt,
      };
    }
    if (latestRequestState === "REJECTED") {
      return {
        state: "REJECTED",
        destinationKind: "EMPLOYER_VERIFICATION",
        href: EMPLOYER_VERIFICATION_HREF,
        observedAt,
      };
    }
    return {
      state: "NEVER_APPLIED",
      destinationKind: "EMPLOYER_VERIFICATION",
      href: EMPLOYER_VERIFICATION_HREF,
      observedAt,
    };
  }
}

export function createRecruiterHeaderStatusService(
  repository: RecruiterHeaderStatusRepositoryPort,
) {
  return new RecruiterHeaderStatusService(repository);
}
