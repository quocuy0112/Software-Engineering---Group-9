import type { BusinessRegistryLookupResult } from "@/backend/business-registry/business-registry-lookup-gateway";

export type EmployerApplicantRelationshipValue =
  | "LEGAL_OWNER"
  | "AUTHORIZED_EMPLOYEE"
  | "INVITED_MEMBER"
  | "EXISTING_OWNER_APPROVAL"
  | "OTHER";

export type VerificationPreparationDraftChanges = {
  applicantLegalName?: string | null;
  applicantRegisteredAddress?: string | null;
  operatingAddressDiffers?: boolean;
  operatingAddress?: string | null;
  companyPhone?: string | null;
  website?: string | null;
  relationship?: EmployerApplicantRelationshipValue | null;
  currentJobTitle?: string | null;
  authorityExplanation?: string | null;
  mismatchExplanation?: string | null;
};

export type RegistrySnapshotRecord = {
  id: string;
  normalizedTaxIdentifier: string;
  providerKey: string;
  outcome: "MATCHED" | "PARTIAL" | "NOT_FOUND" | "UNAVAILABLE";
  registryLegalName: string | null;
  registryRegisteredAddress: string | null;
  registryEstablishedAt: Date | null;
  registryLegalStatus: string | null;
  registryEntityType: string | null;
  checkedAt: Date;
  expiresAt: Date;
};

export type VerificationPreparationRecord = {
  id: string;
  version: number;
  lookupSnapshotId: string | null;
  applicantLegalName: string | null;
  applicantRegisteredAddress: string | null;
  operatingAddressDiffers: boolean;
  operatingAddress: string | null;
  companyPhoneE164: string | null;
  websiteOrigin: string | null;
  relationship: EmployerApplicantRelationshipValue | null;
  currentJobTitle: string | null;
  authorityExplanation: string | null;
  mismatchExplanation: string | null;
  lookupSnapshot: RegistrySnapshotRecord | null;
};

export type CompanyEmailChallengeRecord = {
  id: string;
  normalizedEmail: string | null;
  state: "PENDING" | "VERIFIED" | "CONSUMED" | "SUPERSEDED" | "EXPIRED";
  expiresAt: Date;
  verifiedAt: Date | null;
};

export interface EmployerVerificationPreparationRepository {
  isActiveUser(userId: string): Promise<boolean>;
  hasReusableLookup(input: {
    userId: string;
    taxIdentifier: string;
    checkedAfter: Date;
    now: Date;
  }): Promise<boolean>;
  replaceLookup(input: {
    userId: string;
    taxIdentifier: string;
    result: BusinessRegistryLookupResult;
    responseDigest: string;
    now: Date;
    expiresAt: Date;
    snapshotDeleteAfter: Date;
    preparationExpiresAt: Date;
    sensitiveDeleteAfter: Date;
  }): Promise<void>;
  invalidateCurrentPreparation(input: {
    userId: string;
    now: Date;
    sensitiveDeleteAfter: Date;
  }): Promise<void>;
  updateDraft(input: {
    userId: string;
    preparationId: string;
    version: number;
    changes: VerificationPreparationDraftChanges;
    now: Date;
    expiresAt: Date;
  }): Promise<boolean>;
  findPreparationForChallenge(input: {
    userId: string;
    version: number;
    now: Date;
  }): Promise<VerificationPreparationRecord | null>;
  issueEmailChallenge(input: {
    userId: string;
    snapshotId: string;
    taxIdentifier: string;
    normalizedEmail: string;
    emailDigest: string;
    tokenDigest: string;
    protectedToken: string;
    recipientCiphertext: string;
    now: Date;
    expiresAt: Date;
    sensitiveDeleteAfter: Date;
    metadataDeleteAfter: Date;
  }): Promise<CompanyEmailChallengeRecord>;
  findPendingEmailChallenge(input: {
    userId: string;
    tokenDigest: string;
    now: Date;
  }): Promise<CompanyEmailChallengeRecord | null>;
  verifyEmailChallenge(input: {
    challengeId: string;
    tokenDigest: string;
    now: Date;
  }): Promise<boolean>;
  findCurrentPreparation(
    userId: string,
    now: Date,
  ): Promise<VerificationPreparationRecord | null>;
  findLatestEmailChallenge(
    userId: string,
    snapshotId: string,
  ): Promise<CompanyEmailChallengeRecord | null>;
}
