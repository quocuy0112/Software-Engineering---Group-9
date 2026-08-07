import "server-only";

import { createHmac } from "node:crypto";

import { cvConfiguration, type CvConfiguration } from "@/backend/cv/config";
import { ExtractedSegmentStore } from "@/backend/cv/extraction/extracted-segment-store";
import { DeterministicCvParser } from "@/backend/cv/parsing/deterministic";
import type { CvParser } from "@/backend/cv/parsing/cv-parser";
import { OpenAiCvParser } from "@/backend/cv/parsing/openai";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import type { CvConsentReadGateway } from "@/backend/repositories/cv-import/cv-consent-read-gateway";
import { PrismaCvConsentRepository } from "@/backend/repositories/cv-import/prisma-cv-consent-repository";
import {
  assertCvStageResultCommitAllowed,
  PrismaCvWorkRepository,
  type CvWorkClaim,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import { CreateCvDraftService } from "@/backend/services/cv-import/create-cv-draft";
import { requireCvExternalDispatchAuthorization } from "@/backend/services/cv-import/cv-consent-service";
import {
  cvStageCurrentTime,
  type CvStageOutcome,
  type CvStageProcessContext,
} from "./pipeline";
import {
  createCvWorkerCryptor,
  createCvWorkerStorage,
  cvWorkerDatabaseTimestamp,
} from "./cv-worker-resources";

const REJECTED_CONTENT_RETENTION_MS = 24 * 60 * 60_000;

type Dependencies = Readonly<{
  segments: ExtractedSegmentStore;
  deterministic: CvParser;
  drafts: CreateCvDraftService;
  external?: CvParser;
  consent?: Pick<CvConsentReadGateway, "findLiveExternalConsent">;
  configuration?: CvConfiguration;
  safetySecret?: string;
}>;

function defaults(): Dependencies {
  const storage = createCvWorkerStorage();
  const cryptor = createCvWorkerCryptor();
  const external = cvConfiguration.parser.apiKey
    ? new OpenAiCvParser({ apiKey: cvConfiguration.parser.apiKey })
    : undefined;
  const deterministic: CvParser = !cvConfiguration.parser.deterministicEnabled
    ? {
        parserClass: "DETERMINISTIC_INTERNAL",
        async parse() {
          throw new Error("PARSER_UNAVAILABLE");
        },
      }
    : new DeterministicCvParser({
        environment: serverEnvironment.APP_ENV,
      });
  return {
    segments: new ExtractedSegmentStore({ storage, cryptor }),
    deterministic,
    drafts: new CreateCvDraftService(),
    external,
    consent: new PrismaCvConsentRepository(),
    configuration: cvConfiguration,
    safetySecret: serverEnvironment.TOKEN_SECRET,
  };
}

function deadline<T>(operation: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("CV_WORKER_ABORTED"));
    const timer = setTimeout(() => reject(new Error("PARSER_TIMEOUT")), 60_000);
    timer.unref();
    const abort = () => reject(new Error("CV_WORKER_ABORTED"));
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    });
  });
}

function errorCode(error: unknown): string {
  if (error instanceof Error && "code" in error) return String(error.code);
  return error instanceof Error ? error.message : "";
}

function safeParseFailure(error: unknown) {
  const code = errorCode(error);
  if (
    code === "PARSER_TIMEOUT" ||
    code === "PARSER_UNAVAILABLE" ||
    code === "PARSER_OUTPUT_INVALID" ||
    code === "PARSER_OUTPUT_LIMIT_EXCEEDED" ||
    code === "CONSENT_REQUIRED" ||
    code === "CONSENT_REVOKED"
  ) {
    return code;
  }
  return "PARSER_UNAVAILABLE";
}

async function persistIntegrityFailure(input: {
  claim: CvWorkClaim;
  now: Date;
}) {
  const contentInaccessibleAt = cvWorkerDatabaseTimestamp(input.now);
  const deleteAfter = cvWorkerDatabaseTimestamp(
    new Date(input.now.getTime() + REJECTED_CONTENT_RETENTION_MS),
  );
  await prisma.$transaction(async (transaction) => {
    await assertCvStageResultCommitAllowed(transaction, {
      stage: "PARSE",
      id: input.claim.id,
      uploadId: input.claim.uploadId,
      accountId: input.claim.accountId,
      owner: input.claim.leaseOwner,
      now: contentInaccessibleAt,
    });
    await transaction.cvStoredArtifact.updateMany({
      where: {
        uploadId: input.claim.uploadId,
        accountId: input.claim.accountId,
        deletedAt: null,
        status: {
          in: ["QUARANTINED", "AVAILABLE", "DELETE_PENDING", "DELETE_FAILED"],
        },
      },
      data: {
        status: "DELETE_PENDING",
        contentInaccessibleAt,
        deleteAfter,
        deleteFailureCode: "ARTIFACT_INTEGRITY_FAILED",
      },
    });
    const changed = await transaction.cvUpload.updateMany({
      where: {
        id: input.claim.uploadId,
        accountId: input.claim.accountId,
        status: { in: ["PARSE_QUEUED", "PARSING"] },
        expiresAt: { gt: contentInaccessibleAt },
        contentInaccessibleAt: null,
        deletedAt: null,
      },
      data: {
        status: "VALIDATION_FAILED",
        failureCode: "ARTIFACT_INTEGRITY_FAILED",
        contentInaccessibleAt,
        deleteAfter,
      },
    });
    if (changed.count !== 1) throw new Error("CV_STAGE_RESULT_DISCARDED");
  });
}

async function persistParseFailure(input: {
  claim: CvWorkClaim;
  failureCode: string;
  externalDispatchAttempted: boolean;
  schemaVersion: string;
  now: Date;
}) {
  const completedAt = cvWorkerDatabaseTimestamp(input.now);
  await prisma.$transaction(async (transaction) => {
    await assertCvStageResultCommitAllowed(transaction, {
      stage: "PARSE",
      id: input.claim.id,
      uploadId: input.claim.uploadId,
      accountId: input.claim.accountId,
      owner: input.claim.leaseOwner,
      now: completedAt,
    });
    const changed = await transaction.cvUpload.updateMany({
      where: {
        id: input.claim.uploadId,
        accountId: input.claim.accountId,
        status: { in: ["PARSE_QUEUED", "PARSING"] },
        expiresAt: { gt: completedAt },
        contentInaccessibleAt: null,
        deletedAt: null,
      },
      data: { status: "PARSE_FAILED", failureCode: input.failureCode },
    });
    if (changed.count !== 1) throw new Error("CV_STAGE_RESULT_DISCARDED");
    if (!input.externalDispatchAttempted) return;
    await transaction.auditEvent.createMany({
      data: [
        {
          id: `cvef_${input.claim.id}`.slice(0, 80),
          occurredAt: completedAt,
          actorType: "system",
          action: "cv_import.external_dispatch_failed",
          targetType: "cv_import",
          targetId: input.claim.uploadId,
          result: "FAILURE",
          correlationId: `cv_external_failure_${input.claim.id}`.slice(0, 128),
          context: {
            stage: "PARSE",
            state: "DISPATCH_FAILED",
            failureCode: input.failureCode,
            parserClass: "EXTERNAL_OPENAI",
            schemaVersion: input.schemaVersion,
          },
        },
      ],
      skipDuplicates: true,
    });
  });
}

export class ParseStageProcessor {
  constructor(
    private readonly dependencies: Dependencies = defaults(),
    private readonly workRepository: Pick<
      PrismaCvWorkRepository,
      "assertStageResultCommitAllowed"
    > = new PrismaCvWorkRepository(),
  ) {}

  async process(
    claim: CvWorkClaim,
    context: CvStageProcessContext,
  ): Promise<CvStageOutcome> {
    if (context.signal.aborted) throw new Error("CV_WORKER_ABORTED");
    const work = await prisma.cvParseJob.findFirst({
      where: {
        id: claim.id,
        uploadId: claim.uploadId,
        accountId: claim.accountId,
        status: "PROCESSING",
        leaseOwner: claim.leaseOwner,
      },
      select: {
        id: true,
        uploadId: true,
        accountId: true,
        attemptNumber: true,
        trigger: true,
        parserClass: true,
        consentEventId: true,
        provider: true,
        model: true,
        purposeVersion: true,
        schemaVersion: true,
        upload: {
          select: {
            profileId: true,
            expiresAt: true,
            profile: { select: { revision: true } },
          },
        },
        extraction: {
          select: { outputArtifact: { select: { id: true } } },
        },
        draft: { select: { id: true } },
      },
    });
    if (!work) throw new Error("CV_LEASE_LOST");
    if (work.trigger !== "CANDIDATE_RETRY") {
      await prisma.cvUpload.updateMany({
        where: {
          id: work.uploadId,
          accountId: work.accountId,
          status: { in: ["PARSE_QUEUED", "PARSING"] },
          expiresAt: { gt: context.now },
          contentInaccessibleAt: null,
          deletedAt: null,
          automaticParseAttemptsUsed: {
            lt: Math.min(work.attemptNumber, 3),
          },
        },
        data: {
          automaticParseAttemptsUsed: Math.min(work.attemptNumber, 3),
        },
      });
    }
    if (work.draft) {
      await this.assertResultCommitAllowed(claim, context);
      await prisma.cvUpload.updateMany({
        where: {
          id: work.uploadId,
          accountId: work.accountId,
          status: { in: ["PARSE_QUEUED", "PARSING"] },
          expiresAt: { gt: cvStageCurrentTime(context) },
          contentInaccessibleAt: null,
          deletedAt: null,
        },
        data: { status: "REVIEW_READY", failureCode: null },
      });
      return { status: "SUCCEEDED" };
    }
    const artifactId = work.extraction.outputArtifact?.id;
    if (!artifactId) throw new Error("CV_EXTRACTED_ARTIFACT_NOT_AUTHORIZED");
    let externalDispatchAttempted = false;
    try {
      await prisma.cvUpload.updateMany({
        where: {
          id: work.uploadId,
          accountId: work.accountId,
          status: { in: ["PARSE_QUEUED", "PARSING"] },
        },
        data: { status: "PARSING" },
      });
      const segments = await this.dependencies.segments.openAuthorized({
        accountId: work.accountId,
        uploadId: work.uploadId,
        artifactId,
        parseJobId: work.id,
      });
      const configuration = this.dependencies.configuration ?? cvConfiguration;
      let parser: CvParser;
      let safetyIdentifier: string | undefined;
      if (work.parserClass === "EXTERNAL_OPENAI") {
        await this.assertExternalDispatchAuthorized(work, context);
        if (!this.dependencies.external) throw new Error("PARSER_UNAVAILABLE");
        parser = this.dependencies.external;
        safetyIdentifier = createHmac(
          "sha256",
          this.dependencies.safetySecret ?? serverEnvironment.TOKEN_SECRET,
        )
          .update("smarthire:cv-openai-safety:v1\0", "utf8")
          .update(work.accountId, "utf8")
          .digest("base64url");
        // This is intentionally the final asynchronous gate before the
        // adapter transmits. P0 never attempts a fallback provider.
        await this.assertExternalDispatchAuthorized(work, context);
      } else {
        if (!configuration.parser.deterministicEnabled)
          throw new Error("PARSER_UNAVAILABLE");
        parser = this.dependencies.deterministic;
      }
      externalDispatchAttempted = work.parserClass === "EXTERNAL_OPENAI";
      const result = await deadline(
        parser.parse({
          segments,
          deadline: new Date(context.now.getTime() + 60_000),
          signal: context.signal,
          safetyIdentifier,
        }),
        context.signal,
      );
      if (
        result.dispatch.parserClass !== work.parserClass ||
        result.dispatch.provider !== work.provider ||
        result.dispatch.model !== work.model ||
        result.dispatch.schemaVersion !== work.schemaVersion
      )
        throw new Error("PARSER_OUTPUT_INVALID");
      await this.assertResultCommitAllowed(claim, context);
      await this.dependencies.drafts.execute({
        accountId: work.accountId,
        uploadId: work.uploadId,
        parseJobId: work.id,
        profileId: work.upload.profileId,
        sourceProfileRevision: work.upload.profile.revision,
        output: result.output,
        segments,
        expiresAt: work.upload.expiresAt,
        commitGuard: {
          stage: "PARSE",
          id: claim.id,
          uploadId: claim.uploadId,
          accountId: claim.accountId,
          owner: claim.leaseOwner,
          currentTime: () => cvStageCurrentTime(context),
        },
        dispatchEvidence:
          work.parserClass === "EXTERNAL_OPENAI" && result.providerRequestId
            ? {
                providerRequestIdHmac: Uint8Array.from(
                  createHmac(
                    "sha256",
                    this.dependencies.safetySecret ??
                      serverEnvironment.TOKEN_SECRET,
                  )
                    .update("smarthire:cv-provider-request:v1\0", "utf8")
                    .update(result.providerRequestId, "utf8")
                    .digest(),
                ),
              }
            : undefined,
      });
      return { status: "SUCCEEDED" };
    } catch (error) {
      const code = errorCode(error);
      if (code === "CV_WORKER_ABORTED") throw error;
      if (code === "CV_STAGE_RESULT_DISCARDED") throw error;
      await this.assertResultCommitAllowed(claim, context);
      if (code === "ARTIFACT_INTEGRITY_FAILED") {
        await persistIntegrityFailure({
          claim,
          now: cvStageCurrentTime(context),
        });
        return {
          status: "FAILED",
          failureCode: "ARTIFACT_INTEGRITY_FAILED",
        };
      }
      const failureCode = safeParseFailure(error);
      await persistParseFailure({
        claim,
        failureCode,
        externalDispatchAttempted,
        schemaVersion: work.schemaVersion,
        now: cvStageCurrentTime(context),
      });
      return { status: "FAILED", failureCode };
    }
  }

  private async assertResultCommitAllowed(
    claim: CvWorkClaim,
    context: CvStageProcessContext,
  ): Promise<void> {
    await this.workRepository.assertStageResultCommitAllowed({
      stage: "PARSE",
      id: claim.id,
      uploadId: claim.uploadId,
      accountId: claim.accountId,
      owner: claim.leaseOwner,
      now: cvStageCurrentTime(context),
    });
  }

  private async assertExternalDispatchAuthorized(
    work: Readonly<{
      accountId: string;
      uploadId: string;
      consentEventId: string | null;
      provider: string;
      model: string;
      purposeVersion: string;
    }>,
    context: CvStageProcessContext,
  ): Promise<void> {
    const configuration = this.dependencies.configuration ?? cvConfiguration;
    await requireCvExternalDispatchAuthorization({
      ...work,
      configuration,
      consentGateway:
        this.dependencies.consent ?? new PrismaCvConsentRepository(),
      dispatchAt: cvStageCurrentTime(context),
    });
  }
}
