import "server-only";

import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type CvDatabase = typeof prisma | Prisma.TransactionClient;

export type SafeOwnedCvUpload = Readonly<{
  id: string;
  accountId: string;
  profileId: string;
  documentKind: "PDF" | "DOCX";
  parserClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  status: string;
  declaredMediaType: string;
  declaredBytes: number;
  actualBytes: number | null;
  expiresAt: Date;
  contentInaccessibleAt: Date | null;
  deleteAfter: Date | null;
  deletedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const safeUploadProjection = {
  id: true,
  accountId: true,
  profileId: true,
  documentKind: true,
  parserClass: true,
  status: true,
  declaredMediaType: true,
  declaredBytes: true,
  actualBytes: true,
  expiresAt: true,
  contentInaccessibleAt: true,
  deleteAfter: true,
  deletedAt: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaCvImportRepository {
  constructor(private readonly database: CvDatabase = prisma) {}

  async owns(input: {
    accountId: string;
    resourceId: string;
    resourceType: "upload" | "artifact" | "job" | "draft" | "confirmation";
  }): Promise<boolean> {
    switch (input.resourceType) {
      case "upload":
        return Boolean(
          await this.database.cvUpload.findFirst({
            where: { id: input.resourceId, accountId: input.accountId },
            select: { id: true },
          }),
        );
      case "artifact":
        return Boolean(
          await this.database.cvStoredArtifact.findFirst({
            where: { id: input.resourceId, accountId: input.accountId },
            select: { id: true },
          }),
        );
      case "job":
        return Boolean(
          await this.database.cvParseJob.findFirst({
            where: { id: input.resourceId, accountId: input.accountId },
            select: { id: true },
          }),
        );
      case "draft":
        return Boolean(
          await this.database.cvDraft.findFirst({
            where: { id: input.resourceId, accountId: input.accountId },
            select: { id: true },
          }),
        );
      case "confirmation":
        return Boolean(
          await this.database.cvImportConfirmation.findFirst({
            where: { id: input.resourceId, accountId: input.accountId },
            select: { id: true },
          }),
        );
    }
  }

  async findOwnedUpload(
    accountId: string,
    uploadId: string,
  ): Promise<SafeOwnedCvUpload | null> {
    return this.database.cvUpload.findFirst({
      where: { id: uploadId, accountId },
      select: safeUploadProjection,
    });
  }

  async listOwnedUploads(
    accountId: string,
    limit = 10,
  ): Promise<readonly SafeOwnedCvUpload[]> {
    return this.database.cvUpload.findMany({
      where: { accountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.max(1, Math.min(10, limit)),
      select: safeUploadProjection,
    });
  }

  async findOwnedDraft(accountId: string, draftId: string) {
    return this.database.cvDraft.findFirst({
      where: { id: draftId, accountId },
      select: {
        id: true,
        uploadId: true,
        profileId: true,
        status: true,
        schemaVersion: true,
        revision: true,
        sourceProfileRevision: true,
        reviewedProfileRevision: true,
        proposalPayload: true,
        reviewPayload: true,
        provenancePayload: true,
        expiresAt: true,
        contentInaccessibleAt: true,
        confirmedAt: true,
        updatedAt: true,
      },
    });
  }

  async withTransaction<T>(
    operation: (repository: PrismaCvImportRepository) => Promise<T>,
  ): Promise<T> {
    if ("$transaction" in this.database) {
      return prisma.$transaction((transaction) =>
        operation(new PrismaCvImportRepository(transaction)),
      );
    }
    return operation(this);
  }

  async lockOwnedUpload(
    accountId: string,
    uploadId: string,
  ): Promise<Readonly<{ id: string; status: string }> | null> {
    const rows = await this.database.$queryRaw<
      Array<{ id: string; status: string }>
    >`
      SELECT upload."id", upload."status"::text AS "status"
        FROM "CvUpload" upload
        JOIN "user" account ON account."id" = upload."accountId"
       WHERE upload."id" = ${uploadId}
         AND upload."accountId" = ${accountId}
         AND account."state" = 'ACTIVE'
         AND account."deletedAt" IS NULL
       FOR UPDATE OF upload
    `;
    return rows[0] ?? null;
  }

  async lockOwnedDraftAndProfile(
    accountId: string,
    draftId: string,
  ): Promise<Readonly<{
    draftId: string;
    draftRevision: number;
    draftStatus: string;
    profileId: string;
    profileRevision: number;
  }> | null> {
    const rows = await this.database.$queryRaw<
      Array<{
        draftId: string;
        draftRevision: number;
        draftStatus: string;
        profileId: string;
        profileRevision: number;
      }>
    >`
      SELECT draft."id" AS "draftId",
             draft."revision" AS "draftRevision",
             draft."status"::text AS "draftStatus",
             profile."id" AS "profileId",
             profile."revision" AS "profileRevision"
        FROM "CvDraft" draft
        JOIN "CandidateProfile" profile ON profile."id" = draft."profileId"
        JOIN "user" account ON account."id" = draft."accountId"
       WHERE draft."id" = ${draftId}
         AND draft."accountId" = ${accountId}
         AND account."state" = 'ACTIVE'
         AND account."deletedAt" IS NULL
       FOR UPDATE OF draft, profile
    `;
    return rows[0] ?? null;
  }
}
