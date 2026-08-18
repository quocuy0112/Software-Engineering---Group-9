import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";
import {
  verificationQueueFilterSchema,
  verificationQueuePageSchema,
  verificationReviewDetailSchema,
} from "@/shared/contracts/admin/verification";

function dayStart(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function dayEndExclusive(value: string | undefined) {
  if (!value) return undefined;
  const end = new Date(`${value}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function evidenceSafetyState(item: {
  malwareStatus: string;
  typeStatus: string;
  structureStatus: string;
  previewStatus: string;
}) {
  const values = [
    item.malwareStatus,
    item.typeStatus,
    item.structureStatus,
    item.previewStatus,
  ];
  if (values.some((value) => value === "FAIL")) return "FAIL" as const;
  if (values.some((value) => value === "INDETERMINATE"))
    return "ERROR" as const;
  if (values.every((value) => value === "PASS")) return "PASS" as const;
  return "PENDING" as const;
}

function evidenceAccessibility(item: {
  contentInaccessibleAt: Date | null;
  deletedAt: Date | null;
  supersededAt: Date | null;
  qualified: boolean;
}) {
  if (item.deletedAt) return "DELETED" as const;
  if (item.contentInaccessibleAt || item.supersededAt || !item.qualified)
    return "INACCESSIBLE" as const;
  return "AVAILABLE" as const;
}

function evidenceFileName(mediaType: string, version: number) {
  const extension =
    mediaType === "application/pdf"
      ? "pdf"
      : mediaType === "image/png"
        ? "png"
        : "jpg";
  return `business-license-${version}.${extension}`;
}

export class PrismaVerificationRepository {
  async listQueue(input: {
    page: number;
    pageSize: number;
    filter: Record<string, unknown>;
    adminUserId: string;
  }) {
    const filter = verificationQueueFilterSchema.parse({
      ...input.filter,
      page: input.page,
      pageSize: input.pageSize,
    });
    const taxCode = filter.taxCode ?? filter.taxIdentifier;
    const where: Prisma.RecruiterVerificationRequestWhereInput = {
      state: filter.state,
      applicant: {
        state:
          filter.applicantEligibility === "ACTIVE_ONLY"
            ? "ACTIVE"
            : filter.applicantEligibility === "SUSPENDED_ONLY"
              ? "SUSPENDED"
              : { in: ["ACTIVE", "SUSPENDED"] },
      },
      ...(filter.company
        ? {
            submittedCompanyName: {
              contains: filter.company,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filter.targetCompanyId
        ? { targetCompanyId: filter.targetCompanyId }
        : {}),
      ...(taxCode ? { normalizedTaxIdentifier: taxCode } : {}),
      ...(filter.applicantId ? { applicantUserId: filter.applicantId } : {}),
      ...(filter.submittedFrom || filter.submittedTo
        ? {
            createdAt: {
              ...(dayStart(filter.submittedFrom)
                ? { gte: dayStart(filter.submittedFrom) }
                : {}),
              ...(dayEndExclusive(filter.submittedTo)
                ? { lt: dayEndExclusive(filter.submittedTo) }
                : {}),
            },
          }
        : {}),
      ...(filter.assignment === "UNASSIGNED"
        ? { assignedAdminUserId: null }
        : filter.assignment === "MINE"
          ? { assignedAdminUserId: input.adminUserId }
          : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.recruiterVerificationRequest.findMany({
        where,
        include: { applicant: { select: { state: true } } },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.recruiterVerificationRequest.count({ where }),
    ]);
    return verificationQueuePageSchema.parse({
      data: rows.map((row) => ({
        id: row.id,
        applicantId: row.applicantUserId,
        companyName: row.submittedCompanyName,
        taxCode: row.normalizedTaxIdentifier,
        state: row.state,
        applicantEligibility: row.applicant.state,
        submittedAt: row.createdAt.toISOString(),
        resubmissionCount: row.resubmissionCount,
        assignedAdminRef: row.assignedAdminUserId,
        version: row.version,
      })),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      calculatedAt: new Date().toISOString(),
    });
  }

  async reviewDetail(id: string) {
    const now = new Date();
    const row = await prisma.recruiterVerificationRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { name: true, state: true, deletedAt: true } },
        targetCompany: {
          select: { id: true, displayName: true, verificationState: true },
        },
        evidence: { orderBy: { submissionVersion: "desc" } },
        decisions: { orderBy: [{ decidedAt: "asc" }, { id: "asc" }] },
        notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        businessFacts: { select: { requestId: true } },
      },
    });
    if (!row) return null;
    const prerequisite = row.prerequisiteId
      ? await prisma.companyAccessPrerequisite.findUnique({
          where: { id: row.prerequisiteId },
          select: { state: true, expiresAt: true },
        })
      : null;
    const currentEvidence = row.evidence.find(
      (item) => item.id === row.currentEvidenceId,
    );
    const metadata = row.evidence.map((item) => {
      const safetyState = evidenceSafetyState(item);
      const qualified =
        item.id === row.currentEvidenceId &&
        item.submissionVersion === row.currentSubmissionVersion &&
        safetyState === "PASS" &&
        (!row.targetCompany ||
          row.targetCompany.verificationState === "ACTIVE");
      return {
        id: item.id,
        version: item.submissionVersion,
        fileName: evidenceFileName(
          item.detectedMediaType ?? item.declaredMediaType,
          item.submissionVersion,
        ),
        mediaType: item.detectedMediaType ?? item.declaredMediaType,
        byteSize: item.byteSize,
        safetyState,
        accessibility: evidenceAccessibility({
          contentInaccessibleAt: item.contentInaccessibleAt,
          deletedAt: item.deletedAt,
          supersededAt: item.supersededAt,
          qualified,
        }),
      };
    });
    const current =
      metadata.find((item) => item.id === currentEvidence?.id) ?? null;
    const applicantActive =
      row.applicant.state === "ACTIVE" && !row.applicant.deletedAt;
    const prerequisiteAvailable =
      !row.targetCompanyId ||
      (prerequisite?.state === "AVAILABLE" &&
        (!prerequisite.expiresAt || prerequisite.expiresAt > now));
    const evidenceAvailable = current?.accessibility === "AVAILABLE";
    const canDecide =
      row.state === "PENDING_REVIEW" &&
      applicantActive &&
      Boolean(evidenceAvailable) &&
      prerequisiteAvailable &&
      (!row.submissionIdempotencyKey || Boolean(row.businessFacts));
    const blockReason = canDecide
      ? null
      : !applicantActive
        ? "APPLICANT_SUSPENDED"
        : row.state !== "PENDING_REVIEW"
          ? "INVALID_STATE"
          : !evidenceAvailable
            ? "EVIDENCE_UNAVAILABLE"
            : !prerequisiteAvailable
              ? "RELATIONSHIP_REQUIRED"
              : "ENRICHED_FACTS_REQUIRED";
    const request = {
      id: row.id,
      applicantId: row.applicantUserId,
      companyName: row.submittedCompanyName,
      taxCode: row.normalizedTaxIdentifier,
      state: row.state,
      applicantEligibility:
        row.applicant.state === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      submittedAt: row.createdAt.toISOString(),
      resubmissionCount: row.resubmissionCount,
      assignedAdminRef: row.assignedAdminUserId,
      version: row.version,
    };
    return verificationReviewDetailSchema.parse({
      request,
      company: {
        name: row.submittedCompanyName,
        taxCode: row.normalizedTaxIdentifier,
        targetKind: row.targetCompanyId ? "EXISTING_COMPANY" : "NEW_COMPANY",
        prerequisiteState: row.targetCompanyId
          ? (prerequisite?.state ?? "UNAVAILABLE")
          : "NOT_REQUIRED",
      },
      evidence: current,
      versions: metadata,
      decisions: row.decisions.map((decision) => ({
        id: decision.id,
        decision:
          decision.resultingState === "APPROVED"
            ? "APPROVED"
            : decision.resultingState === "REJECTED"
              ? "REJECTED"
              : "CHANGES_REQUESTED",
        category: decision.rejectionCategory,
        applicantComment:
          decision.resultingState === "REJECTED"
            ? (row.adminComment ?? null)
            : null,
        decidedAt: decision.decidedAt.toISOString(),
        reviewerRef: decision.actorAdminUserId,
      })),
      notes: row.notes.map((note) => ({
        id: note.id,
        reviewerRef: note.authorAdminUserId,
        text: note.normalizedText,
        createdAt: note.createdAt.toISOString(),
      })),
      applicantComment: row.adminComment ?? null,
      canDecide,
      blockReason,
      calculatedAt: now.toISOString(),
    });
  }

  async list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
    adminUserId: string;
  }) {
    const now = new Date();
    const where = {
      ...(typeof input.filter.state === "string"
        ? { state: input.filter.state as never }
        : {}),
      ...(typeof input.filter.company === "string"
        ? {
            submittedCompanyName: {
              contains: input.filter.company,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(typeof input.filter.targetCompanyId === "string"
        ? { targetCompanyId: input.filter.targetCompanyId }
        : {}),
      ...(typeof input.filter.taxIdentifier === "string"
        ? { normalizedTaxIdentifier: input.filter.taxIdentifier }
        : {}),
      ...(typeof input.filter.applicantId === "string"
        ? { applicantUserId: input.filter.applicantId }
        : {}),
      ...(input.filter.assignment === "UNASSIGNED"
        ? { assignedAdminUserId: null }
        : input.filter.assignment === "MINE"
          ? { assignedAdminUserId: input.adminUserId }
          : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.recruiterVerificationRequest.findMany({
        where,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.recruiterVerificationRequest.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        applicantAccountId: row.applicantUserId,
        companyName: row.submittedCompanyName,
        requestedRole: row.requestedRole,
        normalizedTaxIdentifier: row.normalizedTaxIdentifier,
        state: row.state,
        submissionVersion: row.currentSubmissionVersion,
        assignedAdministratorId: row.assignedAdminUserId,
        createdAt: row.createdAt.toISOString(),
        version: row.version,
      })),
      total,
      ...calculationMetadata(now),
    };
  }

  async detail(id: string) {
    const row = await prisma.recruiterVerificationRequest.findUnique({
      where: { id },
      include: {
        applicant: { select: { name: true } },
        targetCompany: {
          select: {
            id: true,
            legalName: true,
            verificationState: true,
            memberships: {
              where: { status: "ACTIVE" },
              select: { id: true, userId: true, role: true },
            },
          },
        },
        evidence: { orderBy: { submissionVersion: "desc" } },
        decisions: { orderBy: [{ decidedAt: "asc" }, { id: "asc" }] },
        notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        businessFacts: { include: { lookupSnapshot: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      applicantAccountId: row.applicantUserId,
      applicantDisplayName: row.applicant.name,
      companyName: row.submittedCompanyName,
      normalizedTaxIdentifier: row.normalizedTaxIdentifier,
      targetCompany: row.targetCompany,
      requestedRole: row.requestedRole,
      prerequisiteId: row.prerequisiteId,
      state: row.state,
      currentSubmissionVersion: row.currentSubmissionVersion,
      resubmissionCount: row.resubmissionCount,
      assignedAdministratorId: row.assignedAdminUserId,
      viewerUnavailableSince: row.viewerUnavailableSince?.toISOString() ?? null,
      version: row.version,
      legacyRequest: !row.submissionIdempotencyKey,
      enrichmentStatus: !row.submissionIdempotencyKey
        ? "LEGACY"
        : row.businessFacts
          ? "COMPLETE"
          : "INCOMPLETE",
      businessFacts: row.businessFacts
        ? {
            applicantLegalName: row.businessFacts.applicantLegalName,
            applicantRegisteredAddress:
              row.businessFacts.applicantRegisteredAddress,
            operatingAddress: row.businessFacts.operatingAddress,
            companyEmail: row.businessFacts.companyEmail,
            companyEmailVerifiedAt:
              row.businessFacts.companyEmailVerifiedAt.toISOString(),
            companyEmailFreeProvider:
              row.businessFacts.companyEmailFreeProvider,
            companyEmailWebsiteDomainMatch:
              row.businessFacts.companyEmailWebsiteDomainMatch,
            companyPhoneE164: row.businessFacts.companyPhoneE164,
            companyPhoneVerified: row.businessFacts.companyPhoneVerified,
            websiteOrigin: row.businessFacts.websiteOrigin,
            relationship: row.businessFacts.relationship,
            currentJobTitle: row.businessFacts.currentJobTitle,
            authorityExplanation: row.businessFacts.authorityExplanation,
            legalNameDiffers: row.businessFacts.legalNameDiffers,
            registeredAddressDiffers:
              row.businessFacts.registeredAddressDiffers,
            mismatchExplanation: row.businessFacts.mismatchExplanation,
            accuracyDeclaredAt:
              row.businessFacts.accuracyDeclaredAt.toISOString(),
            documentConsentAt:
              row.businessFacts.documentConsentAt.toISOString(),
            policyVersion: row.businessFacts.policyVersion,
            registry: {
              outcome: row.businessFacts.lookupSnapshot.outcome,
              providerKey: row.businessFacts.lookupSnapshot.providerKey,
              checkedAt:
                row.businessFacts.lookupSnapshot.checkedAt.toISOString(),
              expiresAt:
                row.businessFacts.lookupSnapshot.expiresAt.toISOString(),
              stale:
                row.businessFacts.lookupSnapshot.expiresAt.getTime() <=
                Date.now(),
              legalName: row.businessFacts.lookupSnapshot.registryLegalName,
              registeredAddress:
                row.businessFacts.lookupSnapshot.registryRegisteredAddress,
              establishedAt:
                row.businessFacts.lookupSnapshot.registryEstablishedAt?.toISOString() ??
                null,
              legalStatus: row.businessFacts.lookupSnapshot.registryLegalStatus,
              entityType: row.businessFacts.lookupSnapshot.registryEntityType,
              representativeName:
                row.businessFacts.lookupSnapshot.registryRepresentativeName,
            },
          }
        : null,
      evidence: row.evidence.map((item) => ({
        id: item.id,
        requestId: item.requestId,
        submissionVersion: item.submissionVersion,
        declaredMediaType: item.declaredMediaType,
        detectedMediaType: item.detectedMediaType,
        byteSize: item.byteSize,
        malwareStatus: item.malwareStatus,
        typeStatus: item.typeStatus,
        structureStatus: item.structureStatus,
        previewStatus: item.previewStatus,
        createdAt: item.createdAt.toISOString(),
        accessible:
          !item.contentInaccessibleAt &&
          !item.deletedAt &&
          item.malwareStatus === "PASS" &&
          item.typeStatus === "PASS" &&
          item.structureStatus === "PASS" &&
          item.previewStatus === "PASS",
      })),
      decisions: row.decisions,
      notes: row.notes.map((note) => ({
        id: note.id,
        authorAdminUserId: note.authorAdminUserId,
        normalizedText: note.normalizedText,
        createdAt: note.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
