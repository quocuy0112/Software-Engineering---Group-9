import "server-only";

import type {
  CvWorkClaim,
  CvWorkStage,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import { cvConfiguration } from "@/backend/cv/config";
import { ClamAvScanner } from "@/backend/cv/scanning/clamav";
import { prisma } from "@/backend/database/prisma";
import { assertCvExternalDeploymentGate } from "@/backend/services/cv-import/cv-consent-service";
import { ExtractionStageProcessor } from "./extraction-stage";
import { ParseStageProcessor } from "./parse-stage";
import { ScanStageProcessor } from "./scan-stage";
import { createCvWorkerStorage } from "./cv-worker-resources";
import { CvCleanupCoordinator } from "./cleanup";
import { CvStorageReconciliation } from "./reconciliation";
import { systemClock, type Clock } from "@/backend/time/clock";

export type CvStageOutcome = Readonly<{
  status: string;
  failureCode?: string;
}>;

export type CvStageProcessContext = Readonly<{
  signal: AbortSignal;
  now: Date;
  currentTime?: () => Date;
}>;

export function cvStageCurrentTime(context: CvStageProcessContext): Date {
  const current = context.currentTime?.() ?? context.now;
  if (Number.isNaN(current.getTime())) {
    throw new Error("CV_WORKER_CLOCK_INVALID");
  }
  return current;
}

export type CvStageProcessor = (
  claim: CvWorkClaim,
  context: CvStageProcessContext,
) => Promise<CvStageOutcome>;

export class CvWorkerPipeline {
  private readonly processors: ReadonlyMap<CvWorkStage, CvStageProcessor>;

  constructor(
    processors: Readonly<Partial<Record<CvWorkStage, CvStageProcessor>>>,
  ) {
    this.processors = new Map(
      Object.entries(processors) as Array<[CvWorkStage, CvStageProcessor]>,
    );
  }

  enabledStages(): readonly CvWorkStage[] {
    return Object.freeze([...this.processors.keys()]);
  }

  has(stage: CvWorkStage): boolean {
    return this.processors.has(stage);
  }

  async process(
    stage: CvWorkStage,
    claim: CvWorkClaim,
    context: CvStageProcessContext,
  ): Promise<CvStageOutcome> {
    const processor = this.processors.get(stage);
    if (!processor) throw new Error("CV_STAGE_PROCESSOR_UNAVAILABLE");
    if (context.signal.aborted) throw new Error("CV_WORKER_ABORTED");
    const outcome = await processor(claim, context);
    if (!outcome.status || outcome.status.length > 80) {
      throw new Error("CV_STAGE_OUTCOME_INVALID");
    }
    return Object.freeze({
      status: outcome.status,
      ...(outcome.failureCode
        ? { failureCode: outcome.failureCode.slice(0, 100) }
        : {}),
    });
  }
}

export function createDefaultCvWorkerPipeline() {
  const storage = createCvWorkerStorage();
  const processors: Partial<Record<CvWorkStage, CvStageProcessor>> = {
    DELETE: createCvArtifactDeleteProcessor(storage),
  };
  if (cvConfiguration.workerEnabled) {
    const scan = new ScanStageProcessor();
    const extraction = new ExtractionStageProcessor();
    const parse = new ParseStageProcessor();
    processors.SCAN = (claim, context) => scan.process(claim, context);
    processors.EXTRACTION = (claim, context) =>
      extraction.process(claim, context);
    processors.PARSE = (claim, context) => parse.process(claim, context);
  }
  return new CvWorkerPipeline(processors);
}

export function createCvArtifactDeleteProcessor(
  storage = createCvWorkerStorage(),
): CvStageProcessor {
  return async (claim) => {
    const artifact = await prisma.cvStoredArtifact.findFirst({
      where: {
        id: claim.id,
        uploadId: claim.uploadId,
        accountId: claim.accountId,
        status: "DELETING",
        deleteLeaseOwner: claim.leaseOwner,
      },
      select: { storageLocator: true },
    });
    if (!artifact) throw new Error("CV_LEASE_LOST");
    await storage.assertReady();
    // Provider absence is a successful idempotent physical-delete outcome.
    await storage.delete(artifact.storageLocator);
    return { status: "DELETED" };
  };
}

export async function createCvWorkerReadiness(
  processingEnabled = cvConfiguration.workerEnabled,
) {
  const storage = createCvWorkerStorage();
  await storage.assertReady();
  if (!processingEnabled) return;
  if (cvConfiguration.parser.adapter === "openai") {
    assertCvExternalDeploymentGate(cvConfiguration);
  }
  const scanner = new ClamAvScanner({
    socketPath: cvConfiguration.scanner.socketPath,
    signatureMaximumAgeMs:
      cvConfiguration.scanner.signatureMaximumAgeHours * 60 * 60 * 1000,
  });
  await scanner.assertReady();
}

export function createCvWorkerMaintenance(
  input: {
    clock?: Clock;
    cleanup?: CvCleanupCoordinator;
    reconciliation?: CvStorageReconciliation;
    reconciliationIntervalMs?: number;
  } = {},
) {
  const clock = input.clock ?? systemClock;
  const cleanup = input.cleanup ?? new CvCleanupCoordinator(clock);
  const reconciliation =
    input.reconciliation ?? new CvStorageReconciliation(undefined, clock);
  const interval = input.reconciliationIntervalMs ?? 5 * 60_000;
  if (!Number.isSafeInteger(interval) || interval < 60_000)
    throw new Error("CV_RECONCILIATION_INTERVAL_INVALID");
  let lastReconciliationAt = Number.NEGATIVE_INFINITY;
  let cursor: string | undefined;
  return async function maintainCvRetention(): Promise<void> {
    const now = clock.now();
    await cleanup.runOnce({ now });
    if (now.getTime() - lastReconciliationAt < interval) return;
    const result = await reconciliation.runOnce({
      now,
      ...(cursor ? { cursor } : {}),
    });
    cursor = result.nextCursor;
    lastReconciliationAt = now.getTime();
  };
}

export async function materializePendingDeterministicParseJob() {
  await prisma.$transaction(async (transaction) => {
    const candidates = await transaction.cvUpload.findMany({
      where: {
        status: "PARSE_QUEUED",
        parserClass: "DETERMINISTIC_INTERNAL",
        parseJobs: { none: {} },
        extractions: {
          some: { status: "SUCCEEDED", outputArtifactId: { not: null } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 10,
      include: {
        extractions: {
          where: { status: "SUCCEEDED", outputArtifactId: { not: null } },
          orderBy: { attemptNumber: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    for (const upload of candidates) {
      const extraction = upload.extractions[0];
      if (!extraction) continue;
      const active = await transaction.cvParseJob.findFirst({
        where: {
          accountId: upload.accountId,
          status: { in: ["QUEUED", "PROCESSING"] },
        },
        select: { id: true },
      });
      if (active) continue;
      await transaction.cvParseJob.create({
        data: {
          uploadId: upload.id,
          extractionId: extraction.id,
          accountId: upload.accountId,
          attemptNumber: 1,
          trigger: "INITIAL",
          status: "QUEUED",
          parserClass: "DETERMINISTIC_INTERNAL",
          provider: "smarthire",
          model: "deterministic-v1",
          purposeVersion: "cv-draft-purpose-v1",
          inputVersion: "cv-segments-v1",
          instructionVersion: "cv-extract-v1",
          schemaVersion: "cv-draft-v1",
        },
      });
    }
  });
}
