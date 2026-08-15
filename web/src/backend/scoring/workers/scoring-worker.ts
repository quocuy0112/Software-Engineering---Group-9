import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";

const leaseMilliseconds = 60_000;

export type ScoringWorkOutcome = "SCORED" | "DETERMINISTIC_ONLY";
export type ScoringWorkInput = Readonly<{
  workItemId: string;
  operationId: string;
  applicationId: string;
  expectedGeneration: number;
  attemptNumber: number;
}>;

export type ScoringWorkProcessor = (input: ScoringWorkInput) => Promise<ScoringWorkOutcome>;

/**
 * Coordinates leased scoring work. Calculation and provider calls stay behind
 * the injected processor; this class owns leases, counters, retries, and the
 * terminal operation state so late workers cannot publish stale work silently.
 */
export class ScoringWorker {
  constructor(private readonly db: typeof prisma = prisma, private readonly processor?: ScoringWorkProcessor) {}

  async claim(workerId = `scoring-worker-${randomUUID()}`, now = new Date()) {
    const candidate = await this.db.scoringWorkItem.findFirst({
      where: {
        OR: [
          { state: "QUEUED", nextAttemptAt: { lte: now } },
          { state: "LEASED", leaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!candidate) return null;
    const leaseExpiresAt = new Date(now.getTime() + leaseMilliseconds);
    const claimed = await this.db.$transaction(async (tx) => {
      const changed = await tx.scoringWorkItem.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { state: "QUEUED", nextAttemptAt: { lte: now } },
            { state: "LEASED", leaseExpiresAt: { lte: now } },
          ],
        },
        data: { state: "LEASED", leaseOwner: workerId, leaseExpiresAt, startedAt: now, attemptCount: { increment: 1 } },
      });
      if (changed.count !== 1) return null;
      const item = await tx.scoringWorkItem.findUnique({ where: { id: candidate.id }, select: { id: true, operationId: true, jobApplicationId: true, attemptCount: true, application: { select: { scoringGeneration: true } } } });
      if (!item) return null;
      await tx.scoringOperation.updateMany({ where: { id: item.operationId, state: "QUEUED" }, data: { state: "RUNNING", startedAt: now } });
      return { workItemId: item.id, operationId: item.operationId, applicationId: item.jobApplicationId, expectedGeneration: item.application.scoringGeneration, attemptNumber: item.attemptCount };
    });
    return claimed;
  }

  async runOnce(workerId?: string, now = new Date()) {
    const claimed = await this.claim(workerId, now);
    if (!claimed) return { state: "IDLE" as const };
    if (!this.processor) {
      await this.fail(claimed, "SCORING_PROCESSOR_NOT_CONFIGURED", now);
      return { state: "FAILED" as const, workItemId: claimed.workItemId };
    }
    try {
      const outcome = await this.processor(claimed);
      await this.complete(claimed, outcome, new Date());
      return { state: outcome, workItemId: claimed.workItemId } as const;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "SCORING_WORK_FAILED";
      await this.fail(claimed, code || "SCORING_WORK_FAILED", new Date());
      return { state: "FAILED" as const, workItemId: claimed.workItemId };
    }
  }

  private async complete(input: ScoringWorkInput, outcome: ScoringWorkOutcome, now: Date) {
    await this.db.$transaction(async (tx) => {
      const changed = await tx.scoringWorkItem.updateMany({ where: { id: input.workItemId, state: "LEASED", leaseOwner: { not: null } }, data: { state: outcome === "SCORED" ? "PUBLISHED" : "DETERMINISTIC_ONLY", leaseOwner: null, leaseExpiresAt: null, completedAt: now, lastSafeFailureCode: null } });
      if (changed.count !== 1) return;
      await this.reconcileInTransaction(tx, input.operationId, now);
    });
  }

  private async fail(input: ScoringWorkInput, safeFailureCode: string, now: Date) {
    await this.db.$transaction(async (tx) => {
      const changed = await tx.scoringWorkItem.updateMany({ where: { id: input.workItemId, state: "LEASED" }, data: { state: "FAILED", leaseOwner: null, leaseExpiresAt: null, completedAt: now, lastSafeFailureCode: safeFailureCode, consecutiveAiFailureCount: { increment: 1 } } });
      if (changed.count !== 1) return;
      await this.reconcileInTransaction(tx, input.operationId, now);
    });
  }

  async reconcile(operationId: string, now = new Date()) {
    return this.db.$transaction((tx) => this.reconcileInTransaction(tx, operationId, now));
  }

  private async reconcileInTransaction(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], operationId: string, now: Date) {
    const [total, scored, deterministicOnly, failed, active] = await Promise.all([
      tx.scoringWorkItem.count({ where: { operationId } }),
      tx.scoringWorkItem.count({ where: { operationId, state: "PUBLISHED" } }),
      tx.scoringWorkItem.count({ where: { operationId, state: "DETERMINISTIC_ONLY" } }),
      tx.scoringWorkItem.count({ where: { operationId, state: "FAILED" } }),
      tx.scoringWorkItem.count({ where: { operationId, state: { in: ["QUEUED", "LEASED", "AUTOMATIC_READY", "AI_PENDING"] } } }),
    ]);
    const state = active > 0 ? "RUNNING" : failed > 0 ? "COMPLETED_WITH_FAILURES" : "COMPLETED";
    return tx.scoringOperation.update({ where: { id: operationId }, data: { totalCount: total, succeededCount: scored, deterministicOnlyCount: deterministicOnly, failedCount: failed, state, ...(active === 0 ? { completedAt: now } : {}) } });
  }
}
