import "server-only";

import { createHmac } from "node:crypto";

import { buildCvMetricEvent } from "@/backend/cv/telemetry";
import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaCvConsentRepository } from "@/backend/repositories/cv-import/prisma-cv-consent-repository";
import {
  PrismaCvRetryRepository,
  type CvCandidateRetryResult,
} from "@/backend/repositories/cv-import/prisma-cv-retry-repository";
import type { CvConsentReadGateway } from "@/backend/repositories/cv-import/cv-consent-read-gateway";
import {
  cvRetryAcceptedSchema,
  cvRetryIdempotencyKeySchema,
  type CvRetryAccepted,
} from "@/shared/contracts/cv-import/retry";
import { CvImportServiceError } from "./cv-http-errors";

type RetryRepository = Pick<
  PrismaCvRetryRepository,
  "findReplay" | "inspectCandidateRetry" | "createCandidateRetry"
>;

type RetryMetric = ReturnType<typeof buildCvMetricEvent>;

type RetryCvImportDependencies = Readonly<{
  repository: RetryRepository;
  consentGateway: CvConsentReadGateway;
  idempotencySecret: string;
  now(): Date;
  metric(event: RetryMetric): void | Promise<void>;
}>;

export type RetryCvImportInput = Readonly<{
  accountId: string;
  uploadId: string;
  idempotencyKey: string;
  now?: Date;
}>;

export type RetryCvImportHttpResult = Readonly<{
  outcome: CvRetryAccepted;
  replayed: boolean;
}>;

function defaultDependencies(): RetryCvImportDependencies {
  return {
    repository: new PrismaCvRetryRepository(),
    consentGateway: new PrismaCvConsentRepository(),
    idempotencySecret: serverEnvironment.TOKEN_SECRET,
    now: () => new Date(),
    metric: () => undefined,
  };
}

function endpointDigest(secret: string, key: string): Uint8Array {
  return Uint8Array.from(
    createHmac("sha256", secret)
      .update("smarthire:cv-import:retry-key:v1\0", "utf8")
      .update(key, "utf8")
      .digest(),
  );
}

export class RetryCvImportService {
  private readonly dependencies: RetryCvImportDependencies;

  constructor(dependencies: Partial<RetryCvImportDependencies> = {}) {
    this.dependencies = { ...defaultDependencies(), ...dependencies };
  }

  private async run(
    input: RetryCvImportInput,
  ): Promise<CvCandidateRetryResult> {
    if (!input.accountId)
      throw new CvImportServiceError("AUTHENTICATION_REQUIRED");
    if (!input.uploadId) throw new CvImportServiceError("CV_IMPORT_NOT_FOUND");
    const idempotencyKey = cvRetryIdempotencyKeySchema.safeParse(
      input.idempotencyKey,
    );
    if (!idempotencyKey.success)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const now = input.now ?? this.dependencies.now();
    if (Number.isNaN(now.getTime()))
      throw new CvImportServiceError("VALIDATION_ERROR");
    const digest = endpointDigest(
      this.dependencies.idempotencySecret,
      idempotencyKey.data,
    );
    const lookup = {
      accountId: input.accountId,
      uploadId: input.uploadId,
      idempotencyDigest: digest,
    };
    const replay = await this.dependencies.repository.findReplay(lookup);
    if (replay) return replay;

    const eligibility =
      await this.dependencies.repository.inspectCandidateRetry({
        accountId: input.accountId,
        uploadId: input.uploadId,
        now,
      });
    const consent =
      eligibility.stage === "PARSE" && eligibility.externalConsentBinding
        ? await this.dependencies.consentGateway.findLiveExternalConsent(
            eligibility.externalConsentBinding,
            now,
          )
        : null;
    if (
      eligibility.stage === "PARSE" &&
      eligibility.externalConsentBinding &&
      !consent
    ) {
      throw new CvImportServiceError("CONSENT_REQUIRED");
    }
    const result = await this.dependencies.repository.createCandidateRetry({
      ...lookup,
      now,
      consentId: consent?.consentId ?? null,
    });
    if (!result.replayed) {
      const metric = buildCvMetricEvent({
        metric: "cv_stage_outcome_total",
        value: 1,
        dimensions: {
          stage: result.stage,
          state: "QUEUED",
          resultCode: "CANDIDATE_RETRY_QUEUED",
          parserClass: result.parserClass,
        },
      });
      await Promise.resolve(this.dependencies.metric(metric)).catch(
        () => undefined,
      );
    }
    return result;
  }

  async execute(input: RetryCvImportInput): Promise<CvRetryAccepted> {
    return cvRetryAcceptedSchema.parse((await this.run(input)).outcome);
  }

  async executeForHttp(
    input: RetryCvImportInput,
  ): Promise<RetryCvImportHttpResult> {
    const result = await this.run(input);
    return Object.freeze({
      outcome: cvRetryAcceptedSchema.parse(result.outcome),
      replayed: result.replayed,
    });
  }
}
