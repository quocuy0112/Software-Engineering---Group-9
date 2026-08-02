import "server-only";

export type CvExternalConsentBinding = Readonly<{
  accountId: string;
  uploadId: string;
  provider: string;
  providerClass: "EXTERNAL_OPENAI";
  model: string;
  purposeVersion: string;
  noticeVersion: string;
  consentTextVersion: string;
}>;

export type LiveCvExternalConsent = Readonly<{
  consentId: string;
  occurredAt: Date;
}>;

export interface CvConsentReadGateway {
  findLiveExternalConsent(
    binding: CvExternalConsentBinding,
    now?: Date,
  ): Promise<LiveCvExternalConsent | null>;

  requireLiveExternalConsent(
    binding: CvExternalConsentBinding,
    now?: Date,
  ): Promise<LiveCvExternalConsent>;
}
