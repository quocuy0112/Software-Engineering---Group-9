import "server-only";

import { prisma } from "@/backend/database/prisma";
import { safeFilename } from "@/backend/services/cv-import/cv-import-projection";
import {
  candidateCvDeleteOutcomeSchema,
  candidateCvLibrarySchema,
  candidateCvRenameRequestSchema,
  candidateCvSummarySchema,
  type CandidateCvLibrary,
  type CandidateCvSummary,
} from "@/shared/contracts/cv-import/candidate-cv";

function initialDisplayName(originalName: string | null, fallback: string) {
  const value = originalName?.trim() || fallback;
  return value.slice(0, 200);
}

/**
 * A confirmed CV import has completed the parser/review flow and is therefore
 * eligible for the retained Profile CV library consumed by Apply. The
 * application repository reads only CandidateCv; this projection keeps the
 * temporary import lifecycle out of the application transaction itself.
 */
export async function ensureCandidateCvLibrary(
  userId: string,
  db: typeof prisma = prisma,
) {
  const imports = await db.cvUpload.findMany({
    where: {
      accountId: userId,
      parserClass: {
        in: ["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI"],
      },
      status: "CONFIRMED",
      confirmedAt: { not: null },
      actualBytes: { not: null },
      sourceSha256: { not: null },
      declaredMediaType: {
        in: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      },
    },
    orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      declaredMediaType: true,
      actualBytes: true,
      sourceSha256: true,
      confirmedAt: true,
      displayFilenameCiphertext: true,
    },
  });

  const legacyRows = imports.length
    ? await db.candidateCv.findMany({
        where: {
          candidateUserId: userId,
          storageKey: {
            in: imports.map((upload) => "candidate-cv-" + upload.id),
          },
        },
        select: { storageKey: true, displayName: true },
      })
    : [];
  const existingByStorageKey = new Map(
    legacyRows.map((row) => [row.storageKey, row.displayName]),
  );

  await Promise.all(
    imports.map(async (upload) => {
      if (
        upload.actualBytes === null ||
        upload.sourceSha256 === null ||
        upload.confirmedAt === null
      )
        return;
      const extension =
        upload.declaredMediaType === "application/pdf" ? "pdf" : "docx";
      const storageKey = "candidate-cv-" + upload.id;
      const fileName = "imported-cv-" + upload.id + "." + extension;
      const originalName = initialDisplayName(
        safeFilename(upload.displayFilenameCiphertext, {
          accountId: userId,
          uploadId: upload.id,
        }),
        fileName,
      );
      const checksumSha256 = Buffer.from(upload.sourceSha256).toString("hex");
      const legacyDisplayName = existingByStorageKey.get(storageKey);
      await db.candidateCv.upsert({
        where: { storageKey },
        create: {
          id: "candidate-cv-" + upload.id,
          candidateUserId: userId,
          displayName: originalName,
          fileName,
          mimeType: upload.declaredMediaType,
          byteSize: upload.actualBytes,
          storageKey,
          checksumSha256,
          version: 1,
          confirmedAt: upload.confirmedAt,
        },
        update: {
          ...(legacyDisplayName === "Imported CV"
            ? { displayName: originalName }
            : {}),
          fileName,
          mimeType: upload.declaredMediaType,
          byteSize: upload.actualBytes,
          checksumSha256,
          confirmedAt: upload.confirmedAt,
        },
      });
    }),
  );
}

export async function listCandidateCvLibrary(
  userId: string,
  db: typeof prisma = prisma,
): Promise<CandidateCvLibrary> {
  await ensureCandidateCvLibrary(userId, db);
  const rows = await db.candidateCv.findMany({
    where: {
      candidateUserId: userId,
      confirmedAt: { not: null },
      archivedAt: null,
    },
    orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      displayName: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      version: true,
      confirmedAt: true,
    },
  });
  return candidateCvLibrarySchema.parse({
    items: rows.map((row) =>
      candidateCvSummarySchema.parse({
        id: row.id,
        displayName: row.displayName,
        fileName: row.fileName,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        version: row.version,
        confirmedAt: row.confirmedAt?.toISOString(),
      }),
    ),
  });
}

export class CandidateCvNotFoundError extends Error {
  constructor() {
    super("CANDIDATE_CV_NOT_FOUND");
  }
}

function summary(row: unknown): CandidateCvSummary {
  return candidateCvSummarySchema.parse(row);
}

export async function renameCandidateCv(
  userId: string,
  cvId: string,
  input: unknown,
  db: typeof prisma = prisma,
): Promise<CandidateCvSummary> {
  const { displayName } = candidateCvRenameRequestSchema.parse(input);
  const existing = await db.candidateCv.findFirst({
    where: { id: cvId, candidateUserId: userId, archivedAt: null },
    select: {
      id: true,
      displayName: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      version: true,
      confirmedAt: true,
    },
  });
  if (!existing || !existing.confirmedAt) throw new CandidateCvNotFoundError();
  const updated = await db.candidateCv.update({
    where: { id: existing.id },
    data: { displayName },
    select: {
      id: true,
      displayName: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      version: true,
      confirmedAt: true,
    },
  });
  if (!updated.confirmedAt) throw new CandidateCvNotFoundError();
  return summary({
    ...updated,
    confirmedAt: updated.confirmedAt.toISOString(),
  });
}

export async function archiveCandidateCv(
  userId: string,
  cvId: string,
  db: typeof prisma = prisma,
) {
  const existing = await db.candidateCv.findFirst({
    where: { id: cvId, candidateUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) throw new CandidateCvNotFoundError();
  const archived = await db.candidateCv.update({
    where: { id: existing.id },
    data: { archivedAt: new Date() },
    select: { id: true, archivedAt: true },
  });
  if (!archived.archivedAt) throw new CandidateCvNotFoundError();
  return candidateCvDeleteOutcomeSchema.parse({
    id: archived.id,
    archivedAt: archived.archivedAt.toISOString(),
  });
}
