import "server-only";

import { prisma } from "@/backend/database/prisma";
import { candidateCvSummarySchema } from "@/shared/contracts/cv-import/candidate-cv";
import type { PreparedDirectApplicationCv } from "../jobs/prepare-direct-application-cv";

export async function saveDirectCandidateCv(
  candidateUserId: string,
  prepared: PreparedDirectApplicationCv,
  occurredAt = new Date(),
) {
  try {
    const row = await prisma.candidateCv.create({
      data: {
        id: prepared.id,
        candidateUserId,
        displayName: prepared.displayName,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        byteSize: prepared.byteSize,
        storageKey: prepared.storageKey,
        checksumSha256: prepared.checksumSha256,
        version: 1,
        confirmedAt: occurredAt,
      },
    });
    return candidateCvSummarySchema.parse({
      id: row.id,
      displayName: row.displayName,
      fileName: row.fileName,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      version: row.version,
      confirmedAt: row.confirmedAt?.toISOString(),
    });
  } catch (error) {
    await prepared.cleanup().catch(() => undefined);
    throw error;
  }
}
