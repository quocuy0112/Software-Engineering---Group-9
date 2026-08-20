import "server-only";

import { ANALYTICS_DEFINITION_VERSION, ANALYTICS_PLATFORM_TIME_ZONE } from "@/shared/contracts/analytics";
import { createExportRequestSchema } from "@/shared/contracts/analytics/exports";
import { AnalyticsAuthorization } from "@/backend/analytics/analytics-authorization";
import { PrismaExportRequestRepository } from "@/backend/repositories/analytics/prisma-export-request-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { exportArtifactStorage } from "./storage";
import { exportStatus } from "./export-status";

export class ExportRequestError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 410 | 503,
    public readonly code: string,
  ) {
    super(code);
  }
}

type ExportRepository = Pick<
  PrismaExportRequestRepository,
  "findByIdempotency" | "create" | "findScoped"
>;

export class CandidateExportService {
  constructor(
    private readonly authorization = new AnalyticsAuthorization(),
    private readonly repository: ExportRepository = new PrismaExportRequestRepository(),
  ) {}

  async request(input: {
    userId: string;
    jobPostingId: string;
    idempotencyKey: string;
    body: unknown;
    actorSessionId?: string | null;
    now?: Date;
  }) {
    const scope = await this.authorization.employerJob(input.userId, input.jobPostingId);
    if (!scope) throw new ExportRequestError(404, "TARGET_UNAVAILABLE");
    if (!/^[A-Za-z0-9._:-]{8,128}$/u.test(input.idempotencyKey)) {
      throw new ExportRequestError(400, "IDEMPOTENCY_KEY_INVALID");
    }
    const body = createExportRequestSchema.parse(input.body);
    const now = input.now ?? new Date();
    const existing = await this.repository.findByIdempotency(
      input.userId,
      input.idempotencyKey,
    );
    if (existing) {
      if (
        existing.jobPostingId !== scope.jobPostingId ||
        existing.companyId !== scope.companyId ||
        existing.format !== body.format
      ) {
        throw new ExportRequestError(409, "IDEMPOTENCY_CONFLICT");
      }
      return exportStatus(existing, now);
    }
    let created;
    try {
      created = await this.repository.create({
        requesterUserId: input.userId,
        companyId: scope.companyId,
        jobPostingId: scope.jobPostingId,
        format: body.format,
        dataCutoff: now,
        timeZone: ANALYTICS_PLATFORM_TIME_ZONE,
        definitionVersion: ANALYTICS_DEFINITION_VERSION,
        idempotencyKey: input.idempotencyKey,
        requestedAt: now,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const replay = await this.repository.findByIdempotency(
          input.userId,
          input.idempotencyKey,
        );
        if (replay) return exportStatus(replay, now);
      }
      throw error;
    }
    await new PrismaAuditRepository().append({
      occurredAt: now,
      actorType: "user",
      actorUserId: input.userId,
      actorSessionId: input.actorSessionId ?? null,
      action: "analytics.export.requested",
      targetType: "export_request",
      targetId: created.id,
      result: "SUCCESS",
      correlationId: created.id,
      context: { format: created.format },
    });
    return exportStatus(created, now);
  }

  async status(input: {
    userId: string;
    jobPostingId: string;
    exportId: string;
    now?: Date;
  }) {
    const scope = await this.authorization.employerJob(input.userId, input.jobPostingId);
    if (!scope) throw new ExportRequestError(404, "TARGET_UNAVAILABLE");
    const row = await this.repository.findScoped(
      input.userId,
      scope.jobPostingId,
      input.exportId,
    );
    if (!row) throw new ExportRequestError(404, "TARGET_UNAVAILABLE");
    return exportStatus(row, input.now);
  }

  async download(input: {
    userId: string;
    jobPostingId: string;
    exportId: string;
    now?: Date;
    actorSessionId?: string | null;
  }) {
    const scope = await this.authorization.employerJob(input.userId, input.jobPostingId);
    if (!scope) throw new ExportRequestError(404, "TARGET_UNAVAILABLE");
    const row = await this.repository.findScoped(
      input.userId,
      scope.jobPostingId,
      input.exportId,
    );
    if (!row) throw new ExportRequestError(404, "TARGET_UNAVAILABLE");
    const now = input.now ?? new Date();
    if (
      row.status !== "SUCCEEDED" ||
      !row.storageLocator ||
      !row.checksum ||
      !row.fileName ||
      !row.mediaType ||
      !row.expiresAt ||
      row.expiresAt <= now
    ) {
      throw new ExportRequestError(
        row.status === "EXPIRED" || (row.expiresAt !== null && row.expiresAt <= now)
          ? 410
          : 404,
        "EXPORT_UNAVAILABLE",
      );
    }
    const content = await exportArtifactStorage().get(row.storageLocator);
    const crypto = await import("node:crypto");
    const actualChecksum = crypto.createHash("sha256").update(content).digest("hex");
    if (actualChecksum !== row.checksum || content.byteLength !== row.byteCount) {
      throw new ExportRequestError(503, "EXPORT_INTEGRITY_FAILURE");
    }
    await new PrismaAuditRepository().append({
      occurredAt: now,
      actorType: "user",
      actorUserId: input.userId,
      actorSessionId: input.actorSessionId ?? null,
      action: "analytics.export.downloaded",
      targetType: "export_request",
      targetId: row.id,
      result: "SUCCESS",
      correlationId: row.id,
      context: { format: row.format },
    });
    return {
      body: content,
      fileName: row.fileName,
      mediaType: row.mediaType,
      format: row.format,
    };
  }
}
