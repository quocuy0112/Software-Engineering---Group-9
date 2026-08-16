import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

const SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1_000;

export type RankingSnapshotRowInput = Readonly<{
  applicationId: string;
  rankPosition: number;
  scoreState: string;
  finalScore: number | null;
  submittedAt: Date;
}>;

export type RankingSnapshotRecord = Readonly<{
  snapshotId: string;
  jobPostingId: string;
  generation: number;
  filterHash: string;
  sort: string;
  pageSize: number;
  expiresAt: string;
  rows: readonly RankingSnapshotRowInput[];
}>;

export function normalizedRankingFilterHash(input: Record<string, unknown>) {
  return createStableHash(
    Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        if (input[key] !== undefined) result[key] = input[key];
        return result;
      }, {}),
  );
}

function createStableHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function toRecord(row: {
  id: string;
  jobPostingId: string;
  generation: number;
  filterHash: string;
  sort: string;
  pageSize: number;
  expiresAt: Date;
  rows: Array<{
    applicationId: string;
    rankPosition: number;
    scoreState: string;
    finalScore: Prisma.Decimal | null;
    submittedAt: Date;
  }>;
}): RankingSnapshotRecord {
  return {
    snapshotId: row.id,
    jobPostingId: row.jobPostingId,
    generation: row.generation,
    filterHash: row.filterHash,
    sort: row.sort,
    pageSize: row.pageSize,
    expiresAt: row.expiresAt.toISOString(),
    rows: row.rows.map((item) => ({
      applicationId: item.applicationId,
      rankPosition: item.rankPosition,
      scoreState: item.scoreState,
      finalScore: item.finalScore === null ? null : Number(item.finalScore),
      submittedAt: item.submittedAt,
    })),
  };
}

export class PrismaRankingSnapshotRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(input: {
    jobPostingId: string;
    filterHash: string;
    filters: Record<string, unknown>;
    sort: string;
    pageSize: number;
    rows: readonly RankingSnapshotRowInput[];
    now?: Date;
  }): Promise<RankingSnapshotRecord> {
    const now = input.now ?? new Date();
    const filters = Object.fromEntries(
      Object.entries(input.filters).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const snapshot = await this.db.$transaction(async (tx) => {
          const latest = await tx.rankingSnapshot.findFirst({
            where: { jobPostingId: input.jobPostingId },
            orderBy: { generation: "desc" },
            select: { generation: true },
          });
          const created = await tx.rankingSnapshot.create({
            data: {
              jobPostingId: input.jobPostingId,
              generation: (latest?.generation ?? 0) + 1,
              filterHash: input.filterHash,
              filters,
              sort: input.sort,
              pageSize: input.pageSize,
              createdAt: now,
              expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
              rows: {
                createMany: {
                  data: input.rows.map((row) => ({
                    applicationId: row.applicationId,
                    rankPosition: row.rankPosition,
                    scoreState: row.scoreState,
                    finalScore: row.finalScore,
                    submittedAt: row.submittedAt,
                  })),
                },
              },
            },
            select: {
              id: true,
              jobPostingId: true,
              generation: true,
              filterHash: true,
              sort: true,
              pageSize: true,
              expiresAt: true,
            },
          });
          return created;
        });
        return {
          snapshotId: snapshot.id,
          jobPostingId: snapshot.jobPostingId,
          generation: snapshot.generation,
          filterHash: snapshot.filterHash,
          sort: snapshot.sort,
          pageSize: snapshot.pageSize,
          expiresAt: snapshot.expiresAt.toISOString(),
          rows: input.rows,
        };
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("RANKING_SNAPSHOT_CREATE_FAILED");
  }

  async find(input: {
    snapshotId: string;
    jobPostingId: string;
    filterHash: string;
    sort: string;
    pageSize: number;
    now?: Date;
  }): Promise<RankingSnapshotRecord | null> {
    const row = await this.db.rankingSnapshot.findFirst({
      where: {
        id: input.snapshotId,
        jobPostingId: input.jobPostingId,
        filterHash: input.filterHash,
        sort: input.sort,
        pageSize: input.pageSize,
        expiresAt: { gt: input.now ?? new Date() },
      },
      include: { rows: { orderBy: { rankPosition: "asc" } } },
    });
    return row ? toRecord(row) : null;
  }

  async deleteExpired(now = new Date()) {
    return this.db.rankingSnapshot.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  }
}
