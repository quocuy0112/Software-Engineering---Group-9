import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { VerificationReviewService } from "@/backend/admin/verification/verification-review-service";
import { VerificationApprovalTransaction } from "@/backend/admin/verification/verification-approval-transaction";

const suffix = crypto.randomUUID();
const applicantId = `verification-applicant-${suffix}`;
const requestId = `verification-request-${suffix}`;
const evidenceId = `verification-evidence-${suffix}`;
const adminId = `verification-admin-${suffix}`;
const adminSessionId = `verification-session-${suffix}`;
const grantId = `verification-grant-${suffix}`;
const quotaCompanyIds: string[] = [];
const authority = {
  userId: adminId,
  sessionId: adminSessionId,
  grantId,
  proofAt: new Date(),
};

describe("verification decisions", () => {
  beforeEach(async () => {
    const proofAt = new Date();
    await prisma.userAccount.create({
      data: {
        id: adminId,
        name: "Verification Administrator",
        email: `${adminId}@example.test`,
        normalizedEmail: `${adminId}@example.test`,
        state: "ACTIVE",
        emailVerified: true,
      },
    });
    await prisma.platformAdministratorGrant.create({
      data: { id: grantId, userId: adminId },
    });
    await prisma.session.create({
      data: {
        id: adminSessionId,
        token: `token-${suffix}`,
        userId: adminId,
        expiresAt: new Date(proofAt.getTime() + 86_400_000),
        absoluteExpiresAt: new Date(proofAt.getTime() + 86_400_000),
      },
    });
    await prisma.administratorSessionPolicy.create({
      data: {
        grantId,
        designatedSessionId: adminSessionId,
        initialTwoFactorAt: proofAt,
        latestTwoFactorProofAt: proofAt,
        designationVersion: 1,
      },
    });
    await prisma.userAccount.create({
      data: {
        id: applicantId,
        name: "Applicant",
        email: `${applicantId}@example.test`,
        normalizedEmail: `${applicantId}@example.test`,
        state: "ACTIVE",
        emailVerified: true,
        candidateIdentity: { create: {} },
      },
    });
    await prisma.recruiterVerificationRequest.create({
      data: {
        id: requestId,
        applicantUserId: applicantId,
        submittedCompanyName: `Verified Company ${suffix}`,
        normalizedTaxIdentifier: suffix
          .replace(/\D/gu, "")
          .padEnd(10, "0")
          .slice(0, 10),
        requestedRole: "RECRUITER",
        state: "PENDING_REVIEW",
        currentEvidenceId: evidenceId,
        evidence: {
          create: {
            id: evidenceId,
            submissionVersion: 1,
            declaredMediaType: "application/pdf",
            detectedMediaType: "application/pdf",
            byteSize: 100,
            sourceSha256: "a".repeat(64),
            storageAdapter: "filesystem",
            storageLocator: `unused-${suffix}`,
            encryptionKeyVersion: 1,
            iv: "unused",
            authenticationTag: "unused",
            malwareStatus: "PASS",
            typeStatus: "PASS",
            structureStatus: "PASS",
            previewStatus: "PASS",
            reviewableAt: proofAt,
          },
        },
      },
    });
  });

  afterEach(async () => {
    await prisma.emailOutbox.deleteMany({
      where: { verificationRequestId: requestId },
    });
    await prisma.adminCommandReceipt.deleteMany({
      where: { targetReference: requestId },
    });
    const request = await prisma.recruiterVerificationRequest.findUnique({
      where: { id: requestId },
      select: { targetCompanyId: true },
    });
    await prisma.recruiterVerificationRequest.deleteMany({
      where: { id: requestId },
    });
    if (request?.targetCompanyId) {
      await prisma.companyMembership.deleteMany({
        where: { companyId: request.targetCompanyId },
      });
      await prisma.company.deleteMany({
        where: { id: request.targetCompanyId },
      });
    }
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: quotaCompanyIds } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: quotaCompanyIds } },
    });
    quotaCompanyIds.length = 0;
    await prisma.candidateIdentity.delete({ where: { userId: applicantId } });
    await prisma.userAccount.delete({ where: { id: applicantId } });
    await prisma.administratorSessionPolicy.deleteMany({ where: { grantId } });
    await prisma.platformAdministratorGrant.deleteMany({
      where: { id: grantId },
    });
    await prisma.session.deleteMany({ where: { id: adminSessionId } });
    await prisma.userAccount.delete({ where: { id: adminId } });
  });

  it("keeps legacy Request Changes history readable for the compatibility surface", async () => {
    await new VerificationReviewService().requestChanges(authority, requestId, {
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      guidance: "Please submit a clearer complete license.",
      privateNote: "Internal review complete.",
    });
    const row = await prisma.recruiterVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { decisions: true, notes: true, notifications: true },
    });
    expect(row.state).toBe("CHANGES_REQUESTED");
    expect(row.decisions).toHaveLength(1);
    expect(row.notes).toHaveLength(1);
    expect(row.notifications).toHaveLength(1);
  });

  it("allows exactly one concurrent new-company approval and creates one OWNER membership", async () => {
    const transaction = new VerificationApprovalTransaction();
    await new VerificationReviewService().claim(authority, requestId, {
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    });
    const commands = [1, 2].map(() => ({
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      role: "RECRUITER" as const,
    }));
    const results = await Promise.allSettled(
      commands.map((command) =>
        transaction.execute(authority, requestId, command),
      ),
    );
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    const row = await prisma.recruiterVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        targetCompany: { include: { memberships: true } },
        notifications: true,
      },
    });
    expect(row.state).toBe("APPROVED");
    expect(row.targetCompany?.memberships).toHaveLength(1);
    expect(row.targetCompany?.memberships[0]?.role).toBe("OWNER");
    expect(row.notifications).toHaveLength(1);
  });

  it("blocks a new OWNER company after the applicant reaches the three-company limit", async () => {
    for (const index of [1, 2, 3]) {
      const company = await prisma.company.create({
        data: {
          slug: `quota-company-${suffix}-${index}`,
          legalName: `Quota Company ${suffix} ${index}`,
          displayName: `Quota Company ${suffix} ${index}`,
          normalizedTaxIdentifier: `${1000000000 + index}`,
          verificationState: "ACTIVE",
          verifiedAt: new Date(),
          memberships: {
            create: {
              userId: applicantId,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        },
      });
      quotaCompanyIds.push(company.id);
    }

    await new VerificationReviewService().claim(authority, requestId, {
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(
      new VerificationApprovalTransaction().execute(authority, requestId, {
        expectedVersion: 2,
        idempotencyKey: crypto.randomUUID(),
        role: "RECRUITER",
      }),
    ).rejects.toThrow("OWNER_COMPANY_LIMIT_REACHED");

    const row = await prisma.recruiterVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { state: true, targetCompanyId: true },
    });
    expect(row.state).toBe("PENDING_REVIEW");
    expect(row.targetCompanyId).toBeNull();
  });

  it("keeps a truncated company slug valid when the name ends at a separator", async () => {
    await new VerificationReviewService().claim(authority, requestId, {
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    });
    await prisma.recruiterVerificationRequest.update({
      where: { id: requestId },
      data: { submittedCompanyName: `${"A".repeat(47)} Company` },
    });

    await new VerificationApprovalTransaction().execute(authority, requestId, {
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      role: "RECRUITER",
    });

    const row = await prisma.recruiterVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { targetCompany: true },
    });
    expect(row.targetCompany?.slug).toMatch(/^[a-z0-9]+-[a-z0-9-]+$/u);
    expect(row.targetCompany?.slug).not.toContain("--");
  });

  it("requires a claim before a decision and assigns the case atomically", async () => {
    await expect(
      new VerificationApprovalTransaction().execute(authority, requestId, {
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        role: "RECRUITER",
      }),
    ).rejects.toThrow("CLAIM_REQUIRED");

    const claimed = await new VerificationReviewService().claim(
      authority,
      requestId,
      { expectedVersion: 1, idempotencyKey: crypto.randomUUID() },
    );
    expect(claimed).toMatchObject({
      requestId,
      assignedAdminRef: adminId,
      state: "PENDING_REVIEW",
      version: 2,
    });
    await expect(
      new VerificationApprovalTransaction().execute(authority, requestId, {
        expectedVersion: 2,
        idempotencyKey: crypto.randomUUID(),
        role: "RECRUITER",
      }),
    ).resolves.toMatchObject({ state: "APPROVED" });
  });
});
