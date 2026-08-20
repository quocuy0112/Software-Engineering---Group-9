import "server-only";

import { randomUUID } from "node:crypto";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { AnalyticsAuthorization } from "@/backend/analytics/analytics-authorization";
import { PrismaAnalyticsRepository } from "@/backend/repositories/analytics/prisma-analytics-repository";
import { PrismaExportRequestRepository } from "@/backend/repositories/analytics/prisma-export-request-repository";
import { ANALYTICS_DEFINITION_VERSION } from "@/shared/contracts/analytics";
import { projectCandidateExportRow } from "./candidate-export-projection";
import { writeCandidateCsv } from "./csv-export-writer";
import { writeCandidateXlsx } from "./xlsx-export-writer";
import { exportConfiguration, exportMedia } from "./export-config";
import { exportArtifactStorage } from "./storage";

export class CandidateExportWorker {
  constructor(
    private readonly requests = new PrismaExportRequestRepository(),
    private readonly analytics = new PrismaAnalyticsRepository(),
    private readonly storage = exportArtifactStorage(),
    private readonly authorization = new AnalyticsAuthorization(),
  ) {}

  async runOnce(workerId = randomUUID(), now = new Date()) {
    const configuration = exportConfiguration();
    const leaseExpiresAt = new Date(
      now.getTime() + configuration.leaseSeconds * 1_000,
    );
    const request = await this.requests.claimNext(
      workerId,
      now,
      leaseExpiresAt,
    );
    if (!request) return false;
    let artifactLocator: string | null = null;
    try {
      const scope = await this.authorization.employerJob(
        request.requesterUserId,
        request.jobPostingId,
      );
      if (!scope || scope.companyId !== request.companyId) {
        throw new Error("TARGET_UNAVAILABLE");
      }
      const rows = [];
      let afterId: string | undefined;
      for (;;) {
        const batch = await this.analytics.listCandidateExportRows({
          jobPostingId: request.jobPostingId,
          dataCutoff: request.dataCutoff,
          afterId,
          limit: configuration.batchSize,
        });
        rows.push(...batch.map(projectCandidateExportRow));
        if (batch.length < configuration.batchSize) break;
        afterId = batch[batch.length - 1]?.id;
        if (!afterId) break;
      }
      const content =
        request.format === "CSV"
          ? writeCandidateCsv(rows)
          : await writeCandidateXlsx(rows, {
              Definition: ANALYTICS_DEFINITION_VERSION,
              DataCutoff: request.dataCutoff.toISOString(),
              "Score availability": "Blank score means unavailable at cutoff.",
            });
      const artifact = await this.storage.put(request.id, content);
      artifactLocator = artifact.locator;
      const media = exportMedia[request.format as "CSV" | "XLSX"];
      const fileName =
        "candidates-" + request.jobPostingId + "-" + request.id + "." + media.extension;
      await this.requests.succeed(request.id, {
        workerId,
        storageLocator: artifact.locator,
        fileName,
        mediaType: media.mediaType,
        byteCount: artifact.byteCount,
        checksum: artifact.checksum,
        rowCount: rows.length,
        completedAt: now,
        expiresAt: new Date(
          now.getTime() + configuration.expiresAfterHours * 60 * 60_000,
        ),
      });
      await new PrismaAuditRepository().append({
        occurredAt: now,
        actorType: "user",
        actorUserId: request.requesterUserId,
        actorSessionId: null,
        action: "analytics.export.succeeded",
        targetType: "export_request",
        targetId: request.id,
        result: "SUCCESS",
        correlationId: request.id,
        context: { format: request.format, count: rows.length },
      });
      return true;
    } catch (error) {
      if (artifactLocator) await this.storage.delete(artifactLocator).catch(() => undefined);
      const failureCode =
        error instanceof Error && /^[A-Z0-9_.-]+$/u.test(error.message)
          ? error.message
          : "EXPORT_GENERATION_FAILED";
      const retry = request.attemptCount < configuration.maxAttempts;
      await this.requests.fail(request.id, workerId, failureCode, now, retry);
      if (!retry) {
        await new PrismaAuditRepository().append({
          occurredAt: now,
          actorType: "user",
          actorUserId: request.requesterUserId,
          actorSessionId: null,
          action: "analytics.export.failed",
          targetType: "export_request",
          targetId: request.id,
          result: "FAILURE",
          correlationId: request.id,
          context: { format: request.format, failureCode },
        }).catch(() => undefined);
      }
      return true;
    }
  }
}
