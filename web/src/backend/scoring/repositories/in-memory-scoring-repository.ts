import type { ManualPriority, ScoringOperation } from "@/shared/contracts/scoring";
import type { PublishedScoringRecord, ScoringRepositoryPort } from "./scoring-repository";

export class InMemoryScoringRepository implements ScoringRepositoryPort {
  private readonly records = new Map<string, PublishedScoringRecord>();
  private readonly operations = new Map<string, ScoringOperation>();
  private readonly operationKeys = new Map<string, string>();
  private readonly priorities = new Map<string, ManualPriority>();

  async findCurrent(applicationId: string) {
    return this.records.get(applicationId) ?? null;
  }

  async createOperation(input: Parameters<ScoringRepositoryPort["createOperation"]>[0]) {
    const existingId = this.operationKeys.get(`${input.requestedByUserId}:${input.idempotencyKey}`);
    const existing = existingId ? this.operations.get(existingId) : undefined;
    if (existing) return existing;
    const operation: ScoringOperation = {
      operationId: `operation-${this.operations.size + 1}`,
      kind: input.kind,
      state: "QUEUED",
      totalCount: 0,
      succeededCount: 0,
      deterministicOnlyCount: 0,
      failedCount: 0,
      requestedAt: input.requestedAt.toISOString(),
      completedAt: null,
    };
    this.operations.set(operation.operationId, operation);
    this.operationKeys.set(`${input.requestedByUserId}:${input.idempotencyKey}`, operation.operationId);
    return operation;
  }

  async findOperation(operationId: string) {
    return this.operations.get(operationId) ?? null;
  }

  async publish(input: Parameters<ScoringRepositoryPort["publish"]>[0]) {
    const previous = this.records.get(input.applicationId);
    const record: PublishedScoringRecord = {
      resultId: `result-${input.applicationId}-${(previous?.generation ?? 0) + 1}`,
      generation: (previous?.generation ?? 0) + 1,
      state: input.finalScore ? "SCORED" : "DETERMINISTIC_ONLY",
      automatic: input.automatic,
      ai: input.ai,
      finalScore: input.finalScore,
      operationId: input.operationId,
      consecutiveFailures: input.consecutiveFailures ?? (input.ai ? 0 : (previous?.consecutiveFailures ?? 0) + 1),
      safeFailureCode: input.safeFailureCode ?? (input.ai ? null : (previous?.safeFailureCode ?? "AI_PROVIDER_UNAVAILABLE")),
      rescoreInProgress: false,
    };
    this.records.set(input.applicationId, record);
    return record;
  }

  async setPriority(input: Parameters<ScoringRepositoryPort["setPriority"]>[0]) {
    const current = this.priorities.get(input.applicationId);
    if (input.expectedVersion !== (current?.version ?? 0)) throw new Error("PRIORITY_CONFLICT");
    const priority: ManualPriority = {
      id: `priority-${input.applicationId}-${input.expectedVersion + 1}`,
      value: input.value,
      label: input.value === "HIGH" ? "High review priority" : input.value === "LOW" ? "Low review priority" : input.value === "HOLD" ? "Hold" : "Normal",
      reason: input.reason,
      actorUserId: input.actorUserId,
      setAt: input.now.toISOString(),
      version: input.expectedVersion + 1,
      active: true,
    };
    this.priorities.set(input.applicationId, priority);
    return priority;
  }

  async removePriority(input: Parameters<ScoringRepositoryPort["removePriority"]>[0]) {
    const current = this.priorities.get(input.applicationId);
    if (!current || current.version !== input.expectedVersion) throw new Error("PRIORITY_CONFLICT");
    this.priorities.delete(input.applicationId);
  }
}
