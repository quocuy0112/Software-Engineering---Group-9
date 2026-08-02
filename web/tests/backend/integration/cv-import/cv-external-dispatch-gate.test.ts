import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  CV_APPROVED_OPENAI_ENDPOINT,
  CV_APPROVED_OPENAI_MODEL,
  cvConfiguration,
  cvParserAvailability,
  type CvConfiguration,
} from "@/backend/cv/config";
import { DeterministicCvParser } from "@/backend/cv/parsing/deterministic";
import {
  assertCvExternalDeploymentGate,
  requireCvExternalDispatchAuthorization,
} from "@/backend/services/cv-import/cv-consent-service";

function approvedConfiguration(
  parser: Partial<CvConfiguration["parser"]> = {},
): CvConfiguration {
  return {
    ...cvConfiguration,
    parser: {
      adapter: "openai",
      deterministicEnabled: false,
      endpoint: CV_APPROVED_OPENAI_ENDPOINT,
      model: CV_APPROVED_OPENAI_MODEL,
      enabled: true,
      apiKey: "synthetic-approved-key",
      privacyApproved: true,
      localDevelopmentEnabled: false,
      ...parser,
    },
  };
}

const job = {
  accountId: "account_dispatch_1234",
  uploadId: "upload_dispatch_1234",
  consentEventId: "consent_dispatch_1234",
  provider: "openai",
  model: CV_APPROVED_OPENAI_MODEL,
  purposeVersion: "cv-profile-fact-extraction-v1",
};
const dispatchAt = new Date("2026-08-02T00:00:00.000Z");

describe("external CV dispatch gate", () => {
  it.each([
    ["disabled", { enabled: false }],
    ["missing API key", { apiKey: null }],
    ["wrong adapter", { adapter: "deterministic" as const }],
    ["missing DPA/cross-border/ZDR approval", { privacyApproved: false }],
  ])("fails closed when external processing is %s", (_label, override) => {
    expect(() =>
      assertCvExternalDeploymentGate(approvedConfiguration(override)),
    ).toThrow(expect.objectContaining({ code: "CV_PROCESSING_UNAVAILABLE" }));
  });

  it("allows an explicit local development gate without production privacy assertions", () => {
    expect(() =>
      assertCvExternalDeploymentGate(
        approvedConfiguration({
          privacyApproved: false,
          localDevelopmentEnabled: true,
        }),
      ),
    ).not.toThrow();
  });

  it("can expose deterministic and OpenAI parsers at the same time in local development", () => {
    expect(
      cvParserAvailability(
        approvedConfiguration({
          deterministicEnabled: true,
          privacyApproved: false,
          localDevelopmentEnabled: true,
        }),
      ),
    ).toEqual({ deterministic: true, external: true });
  });

  it("forbids the deterministic fixture parser in production", () => {
    expect(
      () => new DeterministicCvParser({ environment: "production" }),
    ).toThrow("CV_DETERMINISTIC_PARSER_PRODUCTION_FORBIDDEN");
  });

  it.each([
    ["provider", { provider: "fallback-provider" }],
    ["model", { model: `${CV_APPROVED_OPENAI_MODEL}-changed` }],
    ["purpose", { purposeVersion: "changed-purpose" }],
    ["consent ID", { consentEventId: "different_consent_1234" }],
  ])(
    "requires re-consent for a changed %s binding",
    async (_label, override) => {
      const gateway = {
        findLiveExternalConsent: vi.fn(async () => ({
          consentId: job.consentEventId,
          occurredAt: dispatchAt,
        })),
      };
      await expect(
        requireCvExternalDispatchAuthorization({
          ...job,
          ...override,
          configuration: approvedConfiguration(),
          consentGateway: gateway,
          dispatchAt,
        }),
      ).rejects.toEqual(expect.objectContaining({ code: "CONSENT_REQUIRED" }));
    },
  );

  it("blocks a grant revoked between claim and send", async () => {
    const gateway = {
      findLiveExternalConsent: vi
        .fn()
        .mockResolvedValueOnce({
          consentId: job.consentEventId,
          occurredAt: dispatchAt,
        })
        .mockResolvedValueOnce(null),
    };
    const input = {
      ...job,
      configuration: approvedConfiguration(),
      consentGateway: gateway,
      dispatchAt,
    };
    await expect(
      requireCvExternalDispatchAuthorization(input),
    ).resolves.toMatchObject({
      consentId: job.consentEventId,
    });
    await expect(requireCvExternalDispatchAuthorization(input)).rejects.toEqual(
      expect.objectContaining({ code: "CONSENT_REQUIRED" }),
    );
    expect(gateway.findLiveExternalConsent).toHaveBeenCalledTimes(2);
  });

  it("passes the exact consent ID on every authorized attempt and exposes no fallback path", async () => {
    const gateway = {
      findLiveExternalConsent: vi.fn(async () => ({
        consentId: job.consentEventId,
        occurredAt: dispatchAt,
      })),
    };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(
        requireCvExternalDispatchAuthorization({
          ...job,
          configuration: approvedConfiguration(),
          consentGateway: gateway,
          dispatchAt: new Date(dispatchAt.getTime() + attempt),
        }),
      ).resolves.toMatchObject({ consentId: job.consentEventId });
    }
    const source = await readFile(
      "src/backend/cv/workers/parse-stage.ts",
      "utf8",
    );
    expect(
      source.match(/assertExternalDispatchAuthorized\(work, context\)/gu),
    ).toHaveLength(2);
    expect(source).not.toMatch(
      /fallbackParser|secondaryProvider|alternateProvider/iu,
    );
    expect(source).not.toMatch(
      /configuration\.parser\.adapter\s*!==\s*["']deterministic["']/u,
    );
    expect(source).toContain("environment: serverEnvironment.APP_ENV");
  });
});
