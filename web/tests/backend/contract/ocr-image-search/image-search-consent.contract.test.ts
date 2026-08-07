import { describe, expect, it } from "vitest";

import {
  IMAGE_SEARCH_CONSENT_TEXT_VERSION,
  IMAGE_SEARCH_NOTICE_VERSION,
  IMAGE_SEARCH_OPENAI_MODEL,
  IMAGE_SEARCH_PURPOSE_VERSION,
  IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
  searchConsentRequestSchema,
} from "@/shared/contracts/jobs/image-search";

const exactGrant = {
  provider: "openai" as const,
  model: IMAGE_SEARCH_OPENAI_MODEL,
  purposeVersion: IMAGE_SEARCH_PURPOSE_VERSION,
  noticeVersion: IMAGE_SEARCH_NOTICE_VERSION,
  consentTextVersion: IMAGE_SEARCH_CONSENT_TEXT_VERSION,
  retentionDisclosureVersion: IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
};

describe("image-search consent contract", () => {
  it("accepts only the exact approved purpose/provider/model/version grant", () => {
    expect(
      searchConsentRequestSchema.parse({
        action: "GRANTED",
        grant: exactGrant,
      }),
    ).toEqual({ action: "GRANTED", grant: exactGrant });
    for (const grant of [
      { ...exactGrant, provider: "other" },
      { ...exactGrant, model: "mutable-model" },
      { ...exactGrant, purposeVersion: "other-purpose" },
      { ...exactGrant, noticeVersion: "old-notice" },
      { ...exactGrant, consentTextVersion: "old-consent" },
      { ...exactGrant, retentionDisclosureVersion: "old-retention" },
    ])
      expect(
        searchConsentRequestSchema.safeParse({ action: "GRANTED", grant })
          .success,
      ).toBe(false);
  });

  it("represents refusal/revocation without a provider grant and rejects unknown fields", () => {
    expect(
      searchConsentRequestSchema.parse({ action: "REVOKED", grant: null }),
    ).toEqual({ action: "REVOKED", grant: null });
    expect(
      searchConsentRequestSchema.safeParse({
        action: "REVOKED",
        grant: null,
        accountId: "forged",
      }).success,
    ).toBe(false);
    expect(
      searchConsentRequestSchema.safeParse({ action: "GRANTED", grant: null })
        .success,
    ).toBe(false);
  });
});
