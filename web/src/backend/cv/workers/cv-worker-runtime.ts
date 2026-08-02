import "server-only";

import { randomUUID } from "node:crypto";

import {
  PrismaCvWorkRepository,
  type CvWorkClaim,
  type CvWorkStage,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import {
  buildCvLogEvent,
  buildCvMetricEvent,
  buildCvTraceEvent,
} from "@/backend/cv/telemetry";
import { systemClock, type Clock } from "@/backend/time/clock";
import { CvWorkerPipeline } from "./pipeline";

type CvWorkRepository = Pick<
  PrismaCvWorkRepository,
  "claimStage" | "finalizeStage" | "releaseWorkerLeases"
> &
  Readonly<{
    scheduleAutomaticScanRetry?: (input: {
      uploadId: string;
      priorAssessmentId: string;
      now: Date;
    }) => Promise<
      Readonly<{ id: string; attemptNumber: number; replayed?: boolean }>
    >;
    scheduleAutomaticParseRetry?: (input: {
      uploadId: string;
      priorJobId: string;
      now: Date;
    }) => Promise<
      Readonly<{ id: string; attemptNumber: number; replayed?: boolean }>
    >;
  }>;

export type CvWorkerObservability = Readonly<{
  emitLog(event: ReturnType<typeof buildCvLogEvent>): void | Promise<void>;
  emitMetric(
    event: ReturnType<typeof buildCvMetricEvent>,
  ): void | Promise<void>;
  emitTrace?(event: ReturnType<typeof buildCvTraceEvent>): void | Promise<void>;
}>;

export type CvWorkerReadiness = () => Promise<void>;

export type CvWorkerRuntimeOptions = Readonly<{
  repository?: CvWorkRepository;
  pipeline: CvWorkerPipeline;
  clock?: Clock;
  readiness?: CvWorkerReadiness;
  beforePoll?: () => Promise<void>;
  owner?: string;
  concurrency?: number;
  batchSize?: number;
  leaseMs?: number;
  pollMs?: number;
  observability?: CvWorkerObservability;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}>;

const defaultObservability: CvWorkerObservability = Object.freeze({
  emitLog(event) {
    console.info(JSON.stringify(event));
  },
  emitMetric(event) {
    console.info(JSON.stringify(event));
  },
});

function defaultSleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function terminalFailure(stage: CvWorkStage): string {
  switch (stage) {
    case "SCAN":
      return "INDETERMINATE";
    case "EXTRACTION":
    case "PARSE":
      return "FAILED";
    case "DELETE":
      return "DELETE_FAILED";
  }
}

const automaticScanFailures = new Set([
  "SCANNER_UNAVAILABLE",
  "SCANNER_DEFINITIONS_STALE",
]);
const automaticParseFailures = new Set([
  "PARSER_TIMEOUT",
  "PARSER_UNAVAILABLE",
]);

function automaticRetryDelay(
  stage: CvWorkStage,
  claim: CvWorkClaim,
  outcome: Readonly<{ status: string; failureCode?: string }>,
): number | null {
  if (claim.attemptNumber >= 3 || !outcome.failureCode) return null;
  if (
    stage === "SCAN" &&
    outcome.status === "INDETERMINATE" &&
    automaticScanFailures.has(outcome.failureCode)
  ) {
    return claim.attemptNumber === 1 ? 2_000 : 5_000;
  }
  if (
    stage === "PARSE" &&
    outcome.status === "FAILED" &&
    automaticParseFailures.has(outcome.failureCode)
  ) {
    return claim.attemptNumber === 1 ? 2_000 : 5_000;
  }
  return null;
}

export class CvWorkerRuntime {
  private readonly repository: CvWorkRepository;
  private readonly pipeline: CvWorkerPipeline;
  private readonly clock: Clock;
  private readonly readiness: CvWorkerReadiness;
  private readonly beforePoll: () => Promise<void>;
  private readonly owner: string;
  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly pollMs: number;
  private readonly observability: CvWorkerObservability;
  private readonly sleep: NonNullable<CvWorkerRuntimeOptions["sleep"]>;
  private readonly controller = new AbortController();
  private running = false;
  private stopping = false;
  private active = new Set<Promise<void>>();

  constructor(options: CvWorkerRuntimeOptions) {
    this.repository = options.repository ?? new PrismaCvWorkRepository();
    this.pipeline = options.pipeline;
    this.clock = options.clock ?? systemClock;
    this.readiness = options.readiness ?? (async () => undefined);
    this.beforePoll = options.beforePoll ?? (async () => undefined);
    this.owner = options.owner ?? `cv-worker:${randomUUID()}`;
    this.concurrency = options.concurrency ?? 2;
    this.batchSize = options.batchSize ?? this.concurrency;
    this.leaseMs = options.leaseMs ?? 90_000;
    this.pollMs = options.pollMs ?? 1_000;
    this.observability = options.observability ?? defaultObservability;
    this.sleep = options.sleep ?? defaultSleep;
    if (
      !Number.isSafeInteger(this.concurrency) ||
      this.concurrency < 1 ||
      this.concurrency > 16 ||
      !Number.isSafeInteger(this.batchSize) ||
      this.batchSize < 1 ||
      this.batchSize > this.concurrency ||
      !Number.isSafeInteger(this.leaseMs) ||
      this.leaseMs < 1_000 ||
      !Number.isSafeInteger(this.pollMs) ||
      this.pollMs < 10
    ) {
      throw new Error("CV_WORKER_CONFIGURATION_INVALID");
    }
    if (this.pipeline.has("PARSE") && this.leaseMs < 65_000) {
      throw new Error("CV_WORKER_PARSE_LEASE_TOO_SHORT");
    }
  }

  async assertReady(): Promise<void> {
    await this.readiness();
    if (!this.pipeline.has("DELETE")) {
      throw new Error("CV_CLEANUP_PROCESSOR_REQUIRED");
    }
  }

  private async process(stage: CvWorkStage, claim: CvWorkClaim): Promise<void> {
    const now = this.clock.now();
    let resultFinalized = false;
    try {
      const outcome = await this.pipeline.process(stage, claim, {
        signal: this.controller.signal,
        now,
        currentTime: () => this.clock.now(),
      });
      const completedAt = this.clock.now();
      const finalized = await this.repository.finalizeStage({
        stage,
        id: claim.id,
        owner: this.owner,
        status: outcome.status,
        failureCode: outcome.failureCode,
        now: completedAt,
      });
      if (!finalized) return;
      resultFinalized = true;
      await this.emitAuthorizedOutcome(stage, outcome);
      const retryDelay = automaticRetryDelay(stage, claim, outcome);
      if (retryDelay === null) return;
      const dueAt = new Date(completedAt.getTime() + retryDelay);
      if (stage === "SCAN") {
        if (!this.repository.scheduleAutomaticScanRetry)
          throw new Error("CV_AUTOMATIC_RETRY_SCHEDULER_UNAVAILABLE");
        const scheduled = await this.repository.scheduleAutomaticScanRetry({
          uploadId: claim.uploadId,
          priorAssessmentId: claim.id,
          now: dueAt,
        });
        if (!scheduled.replayed) await this.emitAutomaticRetryQueued(stage);
      } else if (stage === "PARSE") {
        if (!this.repository.scheduleAutomaticParseRetry)
          throw new Error("CV_AUTOMATIC_RETRY_SCHEDULER_UNAVAILABLE");
        const scheduled = await this.repository.scheduleAutomaticParseRetry({
          uploadId: claim.uploadId,
          priorJobId: claim.id,
          now: dueAt,
        });
        if (!scheduled.replayed) await this.emitAutomaticRetryQueued(stage);
      }
    } catch (error) {
      if (this.controller.signal.aborted) return;
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : error instanceof Error
            ? error.message
            : "";
      if (code === "CV_STAGE_RESULT_DISCARDED" || code === "CV_LEASE_LOST") {
        return;
      }
      if (resultFinalized) return;
      const failureCode =
        error instanceof Error && /^[A-Z0-9_]{1,100}$/u.test(error.message)
          ? error.message
          : "CV_STAGE_FAILED";
      const finalized = await this.repository
        .finalizeStage({
          stage,
          id: claim.id,
          owner: this.owner,
          status: terminalFailure(stage),
          failureCode,
          now: this.clock.now(),
        })
        .catch(() => false);
      if (finalized) {
        await this.emitAuthorizedOutcome(stage, {
          status: terminalFailure(stage),
          failureCode,
        });
      }
    }
  }

  private async emitAuthorizedOutcome(
    stage: CvWorkStage,
    outcome: Readonly<{ status: string; failureCode?: string }>,
  ): Promise<void> {
    try {
      const log = buildCvLogEvent({
        event: outcome.failureCode ? "cv.stage.failed" : "cv.stage.completed",
        stage,
        state: outcome.status,
        ...(outcome.failureCode ? { resultCode: outcome.failureCode } : {}),
      });
      const metric = buildCvMetricEvent({
        metric: "cv_stage_outcome_total",
        value: 1,
        dimensions: {
          stage,
          state: outcome.status,
          ...(outcome.failureCode ? { resultCode: outcome.failureCode } : {}),
        },
      });
      const trace = buildCvTraceEvent({
        name: "cv.stage.outcome",
        attributes: {
          stage,
          state: outcome.status,
          ...(outcome.failureCode ? { resultCode: outcome.failureCode } : {}),
        },
      });
      await Promise.allSettled([
        Promise.resolve(this.observability.emitLog(log)),
        Promise.resolve(this.observability.emitMetric(metric)),
        ...(this.observability.emitTrace
          ? [Promise.resolve(this.observability.emitTrace(trace))]
          : []),
      ]);
    } catch {
      // A malformed operational dimension is dropped instead of widening the
      // allowlist or affecting an already-authorized database outcome.
    }
  }

  private async emitAutomaticRetryQueued(stage: "SCAN" | "PARSE") {
    try {
      const state = "AUTOMATIC_RETRY_QUEUED";
      const log = buildCvLogEvent({
        event: "cv.stage.completed",
        stage,
        state,
      });
      const metric = buildCvMetricEvent({
        metric: "cv_stage_outcome_total",
        value: 1,
        dimensions: { stage, state },
      });
      const trace = buildCvTraceEvent({
        name: "cv.automatic_retry.queued",
        attributes: { stage, state },
      });
      await Promise.allSettled([
        Promise.resolve(this.observability.emitLog(log)),
        Promise.resolve(this.observability.emitMetric(metric)),
        ...(this.observability.emitTrace
          ? [Promise.resolve(this.observability.emitTrace(trace))]
          : []),
      ]);
    } catch {
      // See emitAuthorizedOutcome: telemetry never changes worker state.
    }
  }

  async pollOnce(): Promise<number> {
    if (this.stopping || this.controller.signal.aborted) return 0;
    await this.beforePoll();
    let claimed = 0;
    for (const stage of this.pipeline.enabledStages()) {
      if (this.active.size >= this.concurrency) break;
      const available = Math.min(
        this.batchSize,
        this.concurrency - this.active.size,
      );
      const rows = await this.repository.claimStage({
        stage,
        owner: this.owner,
        now: this.clock.now(),
        limit: available,
        leaseMs: this.leaseMs,
      });
      claimed += rows.length;
      for (const row of rows) {
        const operation = this.process(stage, row).finally(() => {
          this.active.delete(operation);
        });
        this.active.add(operation);
      }
    }
    return claimed;
  }

  async run(): Promise<void> {
    if (this.running) throw new Error("CV_WORKER_ALREADY_RUNNING");
    this.running = true;
    try {
      await this.assertReady();
      while (!this.stopping && !this.controller.signal.aborted) {
        const claimed = await this.pollOnce();
        if (this.active.size > 0) {
          await Promise.race(this.active);
        } else if (claimed === 0) {
          await this.sleep(this.pollMs, this.controller.signal);
        }
      }
    } finally {
      await this.shutdown();
      this.running = false;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.stopping) {
      this.stopping = true;
      this.controller.abort();
    }
    await Promise.allSettled([...this.active]);
    await this.repository.releaseWorkerLeases(this.owner, this.clock.now());
  }
}
