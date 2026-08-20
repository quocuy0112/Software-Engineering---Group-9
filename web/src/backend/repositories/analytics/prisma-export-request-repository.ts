import "server-only";

import { prisma } from "@/backend/database/prisma";
import { analyticsConfiguration } from "@/backend/analytics/analytics-config";
import type { Prisma } from "@/backend/generated/prisma/client";

type Database = typeof prisma | Prisma.TransactionClient;

export class PrismaExportRequestRepository {
  constructor(private readonly db: Database = prisma) {}

  findByIdempotency(requesterUserId: string, idempotencyKey: string) {
    return this.db.exportRequest.findUnique({
      where: {
        requesterUserId_idempotencyKey: { requesterUserId, idempotencyKey },
      },
    });
  }

  create(input: {
    requesterUserId: string;
    companyId: string;
    jobPostingId: string;
    format: "CSV" | "XLSX";
    dataCutoff: Date;
    timeZone: string;
    definitionVersion: string;
    idempotencyKey: string;
    requestedAt: Date;
  }) {
    return this.db.exportRequest.create({
      data: {
        requesterUserId: input.requesterUserId,
        companyId: input.companyId,
        jobPostingId: input.jobPostingId,
        format: input.format,
        filters: {} as Prisma.InputJsonObject,
        dataCutoff: input.dataCutoff,
        timeZone: input.timeZone,
        definitionVersion: input.definitionVersion,
        idempotencyKey: input.idempotencyKey,
        requestedAt: input.requestedAt,
      },
    });
  }

  findScoped(requesterUserId: string, jobPostingId: string, exportId: string) {
    return this.db.exportRequest.findFirst({
      where: { id: exportId, requesterUserId, jobPostingId },
    });
  }

  async claimNext(workerId: string, now: Date, leaseExpiresAt: Date) {
    const maxAttempts = analyticsConfiguration().exportMaxAttempts;
    const maybeDatabase = this.db as typeof prisma;
    if (
      typeof (maybeDatabase as { $transaction?: unknown }).$transaction ===
      "function"
    ) {
      const database = maybeDatabase;
      return database.$transaction(async (tx: Prisma.TransactionClient) => {
        const candidates = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          'SELECT "id" FROM "ExportRequest" WHERE "attemptCount" < $1 AND ("status" = $2 OR ("status" = $3 AND "leaseExpiresAt" < $4)) ORDER BY "requestedAt" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT 1',
          maxAttempts,
          "QUEUED",
          "LEASED",
          now,
        );
        const candidateId = candidates[0]?.id;
        if (!candidateId) return null;
        await tx.exportRequest.update({
          where: { id: candidateId },
          data: {
            status: "LEASED",
            leaseOwner: workerId,
            leaseExpiresAt,
            startedAt: now,
            attemptCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        return tx.exportRequest.findUnique({ where: { id: candidateId } });
      });
    }
    const client = this.db as Database;
    const candidate = await client.exportRequest.findFirst({
      where: {
        attemptCount: { lt: maxAttempts },
        OR: [
          { status: "QUEUED" },
          { status: "LEASED", leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    const changed = await client.exportRequest.updateMany({
      where: {
        id: candidate.id,
        version: candidate.version,
        OR: [
          { status: "QUEUED" },
          { status: "LEASED", leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: "LEASED",
        leaseOwner: workerId,
        leaseExpiresAt,
        startedAt: candidate.startedAt ?? now,
        attemptCount: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) return null;
    return client.exportRequest.findUnique({ where: { id: candidate.id } });
  }

  succeed(
    exportId: string,
    input: {
      workerId: string;
      storageLocator: string;
      fileName: string;
      mediaType: string;
      byteCount: number;
      checksum: string;
      rowCount: number;
      completedAt: Date;
      expiresAt: Date;
    },
  ) {
    return this.db.exportRequest.updateMany({
      where: {
        id: exportId,
        status: "LEASED",
        leaseOwner: input.workerId,
      },
      data: {
        status: "SUCCEEDED",
        storageLocator: input.storageLocator,
        fileName: input.fileName,
        mediaType: input.mediaType,
        byteCount: input.byteCount,
        checksum: input.checksum,
        rowCount: input.rowCount,
        completedAt: input.completedAt,
        expiresAt: input.expiresAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        version: { increment: 1 },
      },
    });
  }

  fail(
    exportId: string,
    workerId: string,
    failureCode: string,
    now: Date,
    retry: boolean,
  ) {
    return this.db.exportRequest.updateMany({
      where: { id: exportId, status: "LEASED", leaseOwner: workerId },
      data: {
        status: retry ? "QUEUED" : "FAILED",
        failureCode,
        completedAt: retry ? null : now,
        leaseOwner: null,
        leaseExpiresAt: null,
        version: { increment: 1 },
      },
    });
  }

  expire(exportId: string, now: Date) {
    return this.db.exportRequest.updateMany({
      where: {
        id: exportId,
        status: "SUCCEEDED",
        expiresAt: { lte: now },
      },
      data: {
        status: "EXPIRED",
        inaccessibleAt: now,
        version: { increment: 1 },
      },
    });
  }

  findExpired(now: Date, take = 100) {
    return this.db.exportRequest.findMany({
      where: {
        status: "SUCCEEDED",
        expiresAt: { lte: now },
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take,
    });
  }

  markDeleted(exportId: string, now: Date) {
    return this.db.exportRequest.updateMany({
      where: { id: exportId, status: "EXPIRED" },
      data: {
        status: "DELETED",
        deletedAt: now,
        storageLocator: null,
        version: { increment: 1 },
      },
    });
  }
}
