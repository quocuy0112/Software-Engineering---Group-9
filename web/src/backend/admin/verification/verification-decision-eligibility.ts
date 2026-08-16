import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";

type DecisionKind = "APPROVE" | "REJECT";

export type VerificationDecisionEligibility = {
  request: {
    id: string;
    applicantUserId: string;
    submittedCompanyName: string;
    normalizedTaxIdentifier: string;
    targetCompanyId: string | null;
    prerequisiteId: string | null;
    requestedRole: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
    currentEvidenceId: string | null;
    currentSubmissionVersion: number;
    version: number;
    state: "PENDING_REVIEW";
    submissionIdempotencyKey: string | null;
    targetCompany: {
      id: string;
      displayName: string;
      verificationState: "ACTIVE" | "INACTIVE" | "UNVERIFIED";
    } | null;
    acceptedRegistrySnapshot: {
      registryLegalName: string | null;
      registryEntityType: string | null;
    } | null;
    businessFacts: unknown | null;
  };
  evidence: {
    id: string;
    submissionVersion: number;
  };
  prerequisite: { id: string } | null;
  existingMembership: { id: string } | null;
};

function fail(code: string): never {
  throw new Error(code);
}

async function lockRow(
  tx: Prisma.TransactionClient,
  table: "RecruiterVerificationRequest" | "user" | "CompanyAccessPrerequisite",
  id: string,
) {
  // The decision and suspension transactions both acquire the applicant lock
  // before their state write. This closes the suspension/decision race at the
  // database boundary rather than relying on a stale UI projection.
  if (table === "RecruiterVerificationRequest") {
    return tx.$queryRaw<Array<{ id: string; applicantUserId: string }>>(
      Prisma.sql`SELECT "id", "applicantUserId" FROM "RecruiterVerificationRequest" WHERE "id" = ${id} FOR UPDATE`,
    );
  }
  if (table === "user") {
    return tx.$queryRaw<
      Array<{ id: string; state: string; deletedAt: Date | null }>
    >(
      Prisma.sql`SELECT "id", "state", "deletedAt" FROM "user" WHERE "id" = ${id} FOR UPDATE`,
    );
  }
  return tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "CompanyAccessPrerequisite" WHERE "id" = ${id} FOR UPDATE`,
  );
}

async function requireCurrentAdministrator(
  tx: Prisma.TransactionClient,
  authority: AdminAuthority,
  now: Date,
) {
  const [admin, grant, session] = await Promise.all([
    tx.userAccount.findUnique({
      where: { id: authority.userId },
      select: { state: true, deletedAt: true },
    }),
    tx.platformAdministratorGrant.findFirst({
      where: {
        id: authority.grantId,
        userId: authority.userId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { sessionPolicy: true },
    }),
    tx.session.findUnique({
      where: { id: authority.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        absoluteExpiresAt: true,
      },
    }),
  ]);
  const proofAt = grant?.sessionPolicy?.latestTwoFactorProofAt;
  if (
    !admin ||
    admin.state !== "ACTIVE" ||
    admin.deletedAt ||
    !grant?.sessionPolicy ||
    grant.sessionPolicy.designatedSessionId !== authority.sessionId ||
    !session ||
    session.userId !== authority.userId ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.absoluteExpiresAt <= now ||
    !proofAt ||
    proofAt > now ||
    now.getTime() - proofAt.getTime() > 15 * 60_000
  ) {
    fail("STEP_UP_REQUIRED");
  }
}

export async function loadVerificationDecisionEligibility(
  tx: Prisma.TransactionClient,
  input: {
    authority: AdminAuthority;
    requestId: string;
    expectedVersion: number;
    decision: DecisionKind;
    now?: Date;
  },
): Promise<VerificationDecisionEligibility> {
  const now = input.now ?? new Date();
  await requireCurrentAdministrator(tx, input.authority, now);

  const lockedRequest = await lockRow(
    tx,
    "RecruiterVerificationRequest",
    input.requestId,
  );
  if (!lockedRequest[0]) fail("TARGET_UNAVAILABLE");
  await lockRow(
    tx,
    "user",
    (lockedRequest[0] as { id: string; applicantUserId: string })
      .applicantUserId,
  );

  const row = await tx.recruiterVerificationRequest.findUnique({
    where: { id: input.requestId },
    include: {
      targetCompany: {
        select: { id: true, displayName: true, verificationState: true },
      },
      acceptedRegistrySnapshot: {
        select: { registryLegalName: true, registryEntityType: true },
      },
      businessFacts: { select: { requestId: true } },
    },
  });
  if (!row) fail("TARGET_UNAVAILABLE");
  if (row.version !== input.expectedVersion) fail("STALE_CONFLICT");
  if (row.state !== "PENDING_REVIEW") fail("INVALID_STATE");

  const applicant = await tx.userAccount.findUnique({
    where: { id: row.applicantUserId },
    select: { state: true, deletedAt: true },
  });
  if (!applicant || applicant.state !== "ACTIVE" || applicant.deletedAt)
    fail("APPLICANT_SUSPENDED");

  const evidence = row.currentEvidenceId
    ? await tx.businessLicenseEvidence.findUnique({
        where: { id: row.currentEvidenceId },
        select: {
          id: true,
          requestId: true,
          submissionVersion: true,
          malwareStatus: true,
          typeStatus: true,
          structureStatus: true,
          previewStatus: true,
          contentInaccessibleAt: true,
          deletedAt: true,
          supersededAt: true,
        },
      })
    : null;
  if (
    !evidence ||
    evidence.requestId !== row.id ||
    evidence.submissionVersion !== row.currentSubmissionVersion ||
    evidence.malwareStatus !== "PASS" ||
    evidence.typeStatus !== "PASS" ||
    evidence.structureStatus !== "PASS" ||
    evidence.previewStatus !== "PASS" ||
    evidence.contentInaccessibleAt ||
    evidence.deletedAt ||
    evidence.supersededAt
  ) {
    fail("EVIDENCE_UNAVAILABLE");
  }

  let prerequisite: { id: string } | null = null;
  if (row.targetCompanyId) {
    if (!row.targetCompany || row.targetCompany.verificationState !== "ACTIVE")
      fail("RELATIONSHIP_REQUIRED");
    if (!row.prerequisiteId) fail("RELATIONSHIP_REQUIRED");
    await lockRow(tx, "CompanyAccessPrerequisite", row.prerequisiteId);
    const current = await tx.companyAccessPrerequisite.findFirst({
      where: {
        id: row.prerequisiteId,
        applicantUserId: row.applicantUserId,
        companyId: row.targetCompanyId,
        requestId: row.id,
        role: row.requestedRole,
        state: "AVAILABLE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (!current) fail("RELATIONSHIP_REQUIRED");
    prerequisite = current;
  }

  const existingMembership = row.targetCompanyId
    ? await tx.companyMembership.findUnique({
        where: {
          companyId_userId: {
            companyId: row.targetCompanyId,
            userId: row.applicantUserId,
          },
        },
        select: { id: true, status: true },
      })
    : null;
  if (existingMembership?.status === "ACTIVE") fail("DUPLICATE_AUTHORITY");

  if (input.decision === "APPROVE" && row.submissionIdempotencyKey) {
    if (!row.businessFacts) fail("ENRICHED_FACTS_REQUIRED");
  }

  return {
    request: {
      id: row.id,
      applicantUserId: row.applicantUserId,
      submittedCompanyName: row.submittedCompanyName,
      normalizedTaxIdentifier: row.normalizedTaxIdentifier,
      targetCompanyId: row.targetCompanyId,
      prerequisiteId: row.prerequisiteId,
      requestedRole: row.requestedRole,
      currentEvidenceId: row.currentEvidenceId,
      currentSubmissionVersion: row.currentSubmissionVersion,
      version: row.version,
      state: "PENDING_REVIEW",
      submissionIdempotencyKey: row.submissionIdempotencyKey,
      targetCompany: row.targetCompany,
      acceptedRegistrySnapshot: row.acceptedRegistrySnapshot,
      businessFacts: row.businessFacts,
    },
    evidence: {
      id: evidence.id,
      submissionVersion: evidence.submissionVersion,
    },
    prerequisite,
    existingMembership: existingMembership
      ? { id: existingMembership.id }
      : null,
  };
}
