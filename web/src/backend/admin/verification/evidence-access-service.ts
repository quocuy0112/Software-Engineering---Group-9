import "server-only";
import { prisma } from "@/backend/database/prisma";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { S3PrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/s3";
import { normalizeBusinessEvidencePreview } from "./business-evidence-preview";
export class EvidenceAccessService {
  async read(requestId: string, evidenceId: string) {
    const evidence = await prisma.businessLicenseEvidence.findFirst({
      where: {
        id: evidenceId,
        requestId,
        contentInaccessibleAt: null,
        deletedAt: null,
        malwareStatus: "PASS",
        typeStatus: "PASS",
        structureStatus: "PASS",
        previewStatus: "PASS",
        request: {
          state: { in: ["PENDING_REVIEW", "APPROVED"] },
          currentEvidenceId: evidenceId,
          OR: [
            { state: "PENDING_REVIEW" },
            {
              state: "APPROVED",
              targetCompany: { verificationState: "ACTIVE" },
            },
          ],
        },
      },
    });
    if (!evidence) throw new Error("EVIDENCE_UNAVAILABLE");
    const adapter =
      evidence.storageAdapter === "s3"
        ? new S3PrivateBusinessEvidenceStorage()
        : new FilesystemPrivateBusinessEvidenceStorage();
    const bytes = await adapter.read(evidence.storageLocator, evidence);
    return {
      bytes,
      mediaType: evidence.detectedMediaType ?? evidence.declaredMediaType,
      filename: `business-license-${evidence.submissionVersion}.${(evidence.detectedMediaType ?? evidence.declaredMediaType) === "application/pdf" ? "pdf" : (evidence.detectedMediaType ?? evidence.declaredMediaType) === "image/png" ? "png" : "jpg"}`,
    };
  }

  async preview(requestId: string, evidenceId: string) {
    const source = await this.read(requestId, evidenceId);
    return {
      bytes: await normalizeBusinessEvidencePreview(
        source.bytes,
        source.mediaType,
      ),
      mediaType: "image/png",
      filename: "business-license-preview.png",
    };
  }
}
