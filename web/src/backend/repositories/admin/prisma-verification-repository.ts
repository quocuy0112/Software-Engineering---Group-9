import "server-only";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";

export class PrismaVerificationRepository {
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
