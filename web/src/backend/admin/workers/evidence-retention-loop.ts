import "server-only";
import { prisma } from "@/backend/database/prisma";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { S3PrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/s3";
export async function runEvidenceRetentionCycle(now = new Date(), limit = 25) {
  const rows = await prisma.businessLicenseEvidence.findMany({
    where: { deleteAfter: { lte: now }, deletedAt: null },
    orderBy: [{ deleteAfter: "asc" }, { id: "asc" }],
    take: limit,
  });
  let deleted = 0;
  for (const row of rows) {
    try {
      const adapter =
        row.storageAdapter === "s3"
          ? new S3PrivateBusinessEvidenceStorage()
          : new FilesystemPrivateBusinessEvidenceStorage();
      await adapter.delete(row.storageLocator);
      await prisma.businessLicenseEvidence.update({
        where: { id: row.id },
        data: { deletedAt: now },
      });
      deleted++;
    } catch {
      /* leave due for reconciliation */
    }
  }
  return { claimed: rows.length, deleted };
}
