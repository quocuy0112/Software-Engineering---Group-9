import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { CompanyRelationshipPrerequisiteGateway } from "./company-relationship-prerequisite-gateway";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import {
  buildVerificationOutbox,
  createVerificationInAppNotification,
} from "@/backend/admin/notifications/verification-outbox";
type Command = {
  expectedVersion: number;
  idempotencyKey: string;
  role: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
  privateNote?: string;
};
function slug(name: string, suffix: string) {
  return `${
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .toLowerCase()
      .slice(0, 48) || "company"
  }-${suffix.slice(0, 8)}`;
}
export class VerificationApprovalTransaction {
  execute(authority: AdminAuthority, requestId: string, command: Command) {
    const now = new Date();
    return new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: "verification.approve",
        targetReference: requestId,
        idempotencyKey: command.idempotencyKey,
        normalizedBody: command,
      },
      async (tx, correlationId) => {
        const row = await tx.recruiterVerificationRequest.findUnique({
          where: { id: requestId },
          include: {
            targetCompany: { select: { displayName: true } },
            businessFacts: true,
            applicant: { select: { state: true, deletedAt: true } },
          },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== command.expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);
        if (row.state !== "PENDING_REVIEW") throw new Error("INVALID_STATE");
        if (row.applicant.state !== "ACTIVE" || row.applicant.deletedAt) {
          throw new Error("TARGET_UNAVAILABLE");
        }
        if (row.submissionIdempotencyKey && !row.businessFacts) {
          throw new Error("ENRICHED_FACTS_REQUIRED");
        }
        const evidence = await tx.businessLicenseEvidence.findUnique({
          where: { id: row.currentEvidenceId ?? "" },
        });
        if (
          !evidence ||
          [
            evidence.malwareStatus,
            evidence.typeStatus,
            evidence.structureStatus,
            evidence.previewStatus,
          ].some((value) => value !== "PASS") ||
          evidence.contentInaccessibleAt
        )
          throw new Error("EVIDENCE_UNAVAILABLE");
        const version = row.version + 1;
        const claimed = await tx.recruiterVerificationRequest.updateMany({
          where: {
            id: row.id,
            version: command.expectedVersion,
            state: "PENDING_REVIEW",
          },
          data: { version },
        });
        if (claimed.count !== 1)
          throw new AdminCommandConflict("STALE_CONFLICT", version);
        let companyId = row.targetCompanyId;
        let companyDisplayName = row.targetCompany?.displayName;
        let role = command.role;
        let prerequisiteId: string | undefined;
        if (companyId) {
          const prerequisite =
            await new CompanyRelationshipPrerequisiteGateway().require(tx, {
              prerequisiteId: row.prerequisiteId ?? undefined,
              applicantUserId: row.applicantUserId,
              companyId,
              requestedRole: command.role,
              requestId: row.id,
              now,
            });
          prerequisiteId = prerequisite.id;
        } else {
          role = "OWNER";
          const company = await tx.company.create({
            data: {
              slug: slug(row.submittedCompanyName, row.id),
              legalName: row.submittedCompanyName,
              displayName: row.submittedCompanyName,
              normalizedTaxIdentifier: row.normalizedTaxIdentifier,
              verificationState: "ACTIVE",
              verifiedAt: now,
            },
          });
          companyId = company.id;
          companyDisplayName = company.displayName;
        }
        const existingMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: { companyId, userId: row.applicantUserId },
          },
        });
        if (existingMembership?.status === "ACTIVE")
          throw new Error("DUPLICATE_AUTHORITY");
        await tx.companyMembership.upsert({
          where: {
            companyId_userId: { companyId, userId: row.applicantUserId },
          },
          create: {
            companyId,
            userId: row.applicantUserId,
            role,
            priorApprovedRole: role,
            status: "ACTIVE",
            stateChangedAt: now,
          },
          update: {
            role,
            priorApprovedRole: role,
            status: "ACTIVE",
            removedAt: null,
            stateChangedAt: now,
            version: { increment: 1 },
          },
        });
        if (prerequisiteId)
          await tx.companyAccessPrerequisite.update({
            where: { id: prerequisiteId },
            data: {
              state: "USED",
              usedAt: now,
              usedByRequestId: row.id,
              version: { increment: 1 },
            },
          });
        await tx.recruiterVerificationRequest.update({
          where: { id: row.id },
          data: {
            state: "APPROVED",
            targetCompanyId: companyId,
            requestedRole: role,
            decidedAt: now,
          },
        });
        await tx.verificationDecisionHistory.create({
          data: {
            requestId: row.id,
            submissionVersion: row.currentSubmissionVersion,
            actorAdminUserId: authority.userId,
            priorState: row.state,
            resultingState: "APPROVED",
            decisionKind: "APPROVE",
            approvedRole: role,
            result: "SUCCESS",
            correlationId,
            decidedAt: now,
          },
        });
        if (command.privateNote)
          await tx.verificationPrivateNote.create({
            data: {
              requestId: row.id,
              authorAdminUserId: authority.userId,
              normalizedText: command.privateNote,
            },
          });
        await new AuditWriter(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action: "admin.verification_approved",
          targetType: "recruiter_verification",
          targetId: row.id,
          result: "SUCCESS",
          correlationId,
          context: {
            priorState: row.state,
            resultingState: "APPROVED",
            targetVersion: version,
            companyReference: companyId,
          },
        });
        const notification = {
            requestId: row.id,
            userId: row.applicantUserId,
            eventKind: "VERIFICATION_APPROVED",
            resultingState: "APPROVED",
            resultingVersion: version,
            occurredAt: now,
            nextAction: "OPEN_RECRUITER_WORKSPACE",
            companyDisplayName: companyDisplayName!,
            approvedMembershipRole: role,
          } as const;
        await tx.emailOutbox.create({
          data: buildVerificationOutbox(notification),
        });
        await createVerificationInAppNotification(
          tx,
          notification,
          correlationId,
        );
        return { version, state: "APPROVED", companyId, role };
      },
    );
  }
}
