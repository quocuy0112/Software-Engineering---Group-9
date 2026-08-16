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

function renamedFilename(value: string, current: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/\r\n]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 255);
  if (!normalized) return current;
  if (/\.[A-Za-z0-9]{1,8}$/u.test(normalized)) return normalized;
  const extension = current.match(/\.[A-Za-z0-9]{1,8}$/u)?.[0] ?? "";
  return `${normalized}${extension}`.slice(0, 255);
}

function isGeneratedFilename(value: string | undefined): boolean {
  return Boolean(
    value &&
    /^(?:imported-cv|application-cv|candidate-cv)-[A-Za-z0-9-]+\.[A-Za-z0-9]{1,8}$/iu.test(
      value,
    ),
  );
}

function isMaterializedStorageLocator(value: string | undefined): boolean {
  return Boolean(
    value &&
    !value.startsWith("candidate-cv-") &&
    /^[A-Za-z0-9_-]{32,128}$/u.test(value),
  );
}

type ConfirmedCvImport = Readonly<{
  id: string;
  declaredMediaType: string;
  actualBytes: number | null;
  sourceSha256: Uint8Array | null;
  confirmedAt: Date | null;
  displayFilenameCiphertext: string | null;
}>;

async function confirmedCvImports(
  userId: string,
  db: typeof prisma,
): Promise<ConfirmedCvImport[]> {
  // PrismaPg currently exposes PostgreSQL bytea values as objects that the
  // generated client cannot deserialize into Bytes. Encode the checksum in
  // PostgreSQL and reconstruct it here so one bad projection cannot leave a
  // confirmed import without its CandidateCv row.
  if (typeof (db as { $queryRaw?: unknown }).$queryRaw === "function") {
    const rows = await db.$queryRaw<
      Array<{
        id: string;
        declaredMediaType: string;
        actualBytes: number | null;
        sourceSha256Hex: string | null;
        confirmedAt: Date | null;
        displayFilenameCiphertext: string | null;
      }>
    >`
      SELECT upload."id",
             upload."declaredMediaType",
             upload."actualBytes",
             encode(upload."sourceSha256", 'hex') AS "sourceSha256Hex",
             upload."confirmedAt",
             upload."displayFilenameCiphertext"
        FROM "CvUpload" upload
       WHERE upload."accountId" = ${userId}
         AND upload."parserClass" IN ('DETERMINISTIC_INTERNAL', 'EXTERNAL_OPENAI')
         AND upload."status" = 'CONFIRMED'
         AND upload."confirmedAt" IS NOT NULL
         AND upload."actualBytes" IS NOT NULL
         AND upload."sourceSha256" IS NOT NULL
         AND upload."declaredMediaType" IN (
           'application/pdf',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         )
       ORDER BY upload."confirmedAt" DESC, upload."id" DESC
       LIMIT 50
    `;
    return rows.map((row) => ({
      ...row,
      sourceSha256: row.sourceSha256Hex
        ? Buffer.from(row.sourceSha256Hex, "hex")
        : null,
    }));
  }

  // Lightweight test doubles do not implement Prisma's tagged raw-query API.
  return db.cvUpload.findMany({
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
  const imports = await confirmedCvImports(userId, db);

  const desiredIds = imports.map((upload) => "candidate-cv-" + upload.id);
  const desiredStorageKeys = [...desiredIds];
  const legacyRows = imports.length
    ? await db.candidateCv.findMany({
        where: {
          OR: [
            { id: { in: desiredIds } },
            { storageKey: { in: desiredStorageKeys } },
          ],
        },
        select: {
          id: true,
          candidateUserId: true,
          storageKey: true,
          displayName: true,
          fileName: true,
        },
      })
    : [];
  const existingByStorageKey = new Map(
    legacyRows.map((row) => [row.storageKey, row]),
  );
  const existingById = new Map(legacyRows.map((row) => [row.id, row]));

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
      const desiredId = storageKey;
      const fallbackFileName = "candidate-cv." + extension;
      const existing =
        existingByStorageKey.get(storageKey) ?? existingById.get(desiredId);
      if (existing && existing.candidateUserId !== userId) return;
      const recoveredName = safeFilename(upload.displayFilenameCiphertext, {
        accountId: userId,
        uploadId: upload.id,
      });
      const existingUserFilename =
        existing && !isGeneratedFilename(existing.fileName)
          ? existing.fileName
          : null;
      const originalName = initialDisplayName(
        recoveredName ?? existingUserFilename,
        fallbackFileName,
      );
      const checksumSha256 = Buffer.from(upload.sourceSha256).toString("hex");
      const stableId = existing?.id ?? desiredId;
      await db.candidateCv.upsert({
        where: { id: stableId },
        create: {
          id: desiredId,
          candidateUserId: userId,
          displayName: originalName,
          fileName: originalName,
          mimeType: upload.declaredMediaType,
          byteSize: upload.actualBytes,
          storageKey,
          checksumSha256,
          version: 1,
          confirmedAt: upload.confirmedAt,
        },
        update: {
          ...(existing &&
          (existing.displayName === "Imported CV" ||
            isGeneratedFilename(existing.displayName))
            ? { displayName: originalName }
            : {}),
          // A confirmed import is first projected with the stable
          // `candidate-cv-<uploadId>` bridge key.  The confirmation flow then
          // materializes a plaintext copy and replaces that bridge with a
          // private-storage locator.  Do not overwrite the materialized
          // locator every time the library is listed (the old behavior made
          // profile CVs and subsequent application promotions unreadable).
          storageKey:
            existing && isMaterializedStorageLocator(existing.storageKey)
              ? existing.storageKey
              : storageKey,
          fileName: existingUserFilename ?? originalName,
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
    // `storageKey` remains an internal locator. A rename updates the
    // user-facing original filename metadata instead.
    data: {
      displayName,
      fileName: renamedFilename(displayName, existing.fileName),
    },
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
