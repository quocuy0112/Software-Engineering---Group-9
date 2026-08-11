import "server-only";

export type RecruiterHeaderRequestState =
  | "PENDING_CHECKS"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "RESUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export interface RecruiterHeaderStatusRepositoryPort {
  hasQualifyingMembership(userId: string): Promise<boolean>;
  findLatestVerificationState(
    userId: string,
  ): Promise<RecruiterHeaderRequestState | null>;
}
