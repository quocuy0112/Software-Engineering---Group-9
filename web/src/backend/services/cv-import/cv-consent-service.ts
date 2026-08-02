import "server-only";

import {
  CV_APPROVED_OPENAI_ENDPOINT,
  CV_APPROVED_OPENAI_MODEL,
  cvConfiguration,
  type CvConfiguration,
} from "@/backend/cv/config";
import type { Clock } from "@/backend/time/clock";
import { systemClock } from "@/backend/time/clock";
import { PrismaCvConsentRepository } from "@/backend/repositories/cv-import/prisma-cv-consent-repository";
import type {
  CvConsentReadGateway,
  CvExternalConsentBinding,
  LiveCvExternalConsent,
} from "@/backend/repositories/cv-import/cv-consent-read-gateway";
import {
  CV_EXTERNAL_CONSENT_NOTICE_TEXT,
  CV_EXTERNAL_CONSENT_TEXT_VERSION,
  CV_EXTERNAL_PROCESSING_PURPOSE,
  CV_EXTERNAL_PROVIDER,
  CV_EXTERNAL_PROVIDER_CLASS,
  CV_EXTERNAL_PROVIDER_DISPLAY_NAME,
  CV_EXTERNAL_PURPOSE_VERSION,
  cvConsentGrantRequestSchema,
  cvConsentNoticeSchema,
  cvConsentOutcomeSchema,
  type CvConsentGrantRequest,
  type CvConsentNotice,
  type CvConsentOutcome,
} from "@/shared/contracts/cv-import/consent-retention";
import { CV_PROCESSING_NOTICES } from "@/shared/contracts/cv-import/upload";
import { CvImportServiceError } from "./cv-http-errors";

type ConsentRepository = Pick<
  PrismaCvConsentRepository,
  "findLiveExternalConsent" | "issueChallenge" | "grant" | "revoke"
>;

type CvConsentServiceDependencies = Readonly<{
  repository: ConsentRepository;
  configuration: CvConfiguration;
  clock: Clock;
}>;

function defaultDependencies(): CvConsentServiceDependencies {
  return {
    repository: new PrismaCvConsentRepository(),
    configuration: cvConfiguration,
    clock: systemClock,
  };
}

export function cvExternalConsentBinding(input: {
  accountId: string;
  uploadId: string;
  configuration?: CvConfiguration;
}): CvExternalConsentBinding {
  const configuration = input.configuration ?? cvConfiguration;
  return Object.freeze({
    accountId: input.accountId,
    uploadId: input.uploadId,
    provider: CV_EXTERNAL_PROVIDER,
    providerClass: CV_EXTERNAL_PROVIDER_CLASS,
    model: configuration.parser.model,
    purposeVersion: CV_EXTERNAL_PURPOSE_VERSION,
    noticeVersion: CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.noticeVersion,
    consentTextVersion: CV_EXTERNAL_CONSENT_TEXT_VERSION,
  });
}

export function assertCvExternalDeploymentGate(
  configuration: CvConfiguration = cvConfiguration,
): void {
  if (
    configuration.parser.adapter !== "openai" ||
    configuration.parser.endpoint !== CV_APPROVED_OPENAI_ENDPOINT ||
    configuration.parser.model !== CV_APPROVED_OPENAI_MODEL ||
    !configuration.parser.enabled ||
    !configuration.parser.apiKey ||
    !configuration.parser.privacyApproved
  ) {
    throw new CvImportServiceError("CV_PROCESSING_UNAVAILABLE");
  }
}

export async function requireCvExternalDispatchAuthorization(input: {
  accountId: string;
  uploadId: string;
  consentEventId: string | null;
  provider: string;
  model: string;
  purposeVersion: string;
  configuration?: CvConfiguration;
  consentGateway: Pick<CvConsentReadGateway, "findLiveExternalConsent">;
  dispatchAt: Date;
}): Promise<LiveCvExternalConsent> {
  const configuration = input.configuration ?? cvConfiguration;
  assertCvExternalDeploymentGate(configuration);
  const binding = cvExternalConsentBinding({
    accountId: input.accountId,
    uploadId: input.uploadId,
    configuration,
  });
  if (
    !input.consentEventId ||
    input.provider !== binding.provider ||
    input.model !== binding.model ||
    input.purposeVersion !== binding.purposeVersion
  ) {
    throw new CvImportServiceError("CONSENT_REQUIRED");
  }
  const consent = await input.consentGateway.findLiveExternalConsent(
    binding,
    input.dispatchAt,
  );
  if (!consent || consent.consentId !== input.consentEventId)
    throw new CvImportServiceError("CONSENT_REQUIRED");
  return consent;
}

export class CvConsentService {
  private readonly dependencies: CvConsentServiceDependencies;

  constructor(dependencies: Partial<CvConsentServiceDependencies> = {}) {
    this.dependencies = { ...defaultDependencies(), ...dependencies };
  }

  private binding(accountId: string, uploadId: string) {
    if (!accountId) throw new CvImportServiceError("AUTHENTICATION_REQUIRED");
    if (!uploadId) throw new CvImportServiceError("CV_IMPORT_NOT_FOUND");
    return cvExternalConsentBinding({
      accountId,
      uploadId,
      configuration: this.dependencies.configuration,
    });
  }

  async notice(
    accountId: string,
    uploadId: string,
    now = this.dependencies.clock.now(),
  ): Promise<CvConsentNotice> {
    const binding = this.binding(accountId, uploadId);
    const [grant, consentChallenge] = await Promise.all([
      this.dependencies.repository.findLiveExternalConsent(binding, now),
      this.dependencies.repository.issueChallenge(binding, now),
    ]);
    return cvConsentNoticeSchema.parse({
      required: true,
      granted: Boolean(grant),
      providerDisplayName: CV_EXTERNAL_PROVIDER_DISPLAY_NAME,
      processingPurpose: CV_EXTERNAL_PROCESSING_PURPOSE,
      noticeText: CV_EXTERNAL_CONSENT_NOTICE_TEXT,
      consentChallenge,
    });
  }

  async grant(input: {
    accountId: string;
    uploadId: string;
    request: CvConsentGrantRequest;
    now?: Date;
  }): Promise<CvConsentOutcome> {
    const request = cvConsentGrantRequestSchema.safeParse(input.request);
    if (!request.success) throw new CvImportServiceError("VALIDATION_ERROR");
    const now = input.now ?? this.dependencies.clock.now();
    const granted = await this.dependencies.repository.grant({
      ...this.binding(input.accountId, input.uploadId),
      challenge: request.data.consentChallenge,
      occurredAt: now,
    });
    return cvConsentOutcomeSchema.parse({
      uploadId: input.uploadId,
      grantedAt: granted.occurredAt.toISOString(),
      status: "PARSE_QUEUED",
    });
  }

  async revoke(input: {
    accountId: string;
    uploadId: string;
    now?: Date;
  }): Promise<void> {
    await this.dependencies.repository.revoke({
      ...this.binding(input.accountId, input.uploadId),
      occurredAt: input.now ?? this.dependencies.clock.now(),
    });
  }
}
