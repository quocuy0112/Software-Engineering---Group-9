import { describe, expect, it } from "vitest";

import { imageSearchTelemetryEventSchema } from "@/backend/image-search/telemetry";
import {
  REDACTED,
  redactUnknown,
  redactText,
} from "@/backend/security/redaction";

const canaries = {
  imageBytes: "PNG_CANARY_005",
  ocrText: "OCR_CANARY_005",
  nativeText: "CV_CANARY_005",
  proposalValue: "PROPOSAL_CANARY_005",
  evidence: "EVIDENCE_CANARY_005",
  prompt: "PROMPT_CANARY_005",
  requestBody: "PAYLOAD_CANARY_005",
  storageLocator: "LOCATOR_CANARY_005",
  rawIp: "203.0.113.25",
  nonce: "NONCE_CANARY_005",
  capability: "CAPABILITY_CANARY_005",
  secret: "SECRET_CANARY_005",
};

describe("OCR/image-search content leak canaries", () => {
  it("redacts every prohibited content/authority category before logging", () => {
    const safe = JSON.stringify(redactUnknown(canaries));
    for (const value of Object.values(canaries))
      expect(safe).not.toContain(value);
    expect(Object.values(redactUnknown(canaries) as object)).toEqual(
      Array(Object.keys(canaries).length).fill(REDACTED),
    );
    expect(
      redactText("https://app.invalid/?token=TOKEN_CANARY_005"),
    ).not.toContain("TOKEN_CANARY_005");
  });

  it("rejects content, locators, identifiers, and arbitrary dimensions from telemetry", () => {
    const base = {
      purpose: "JOB_IMAGE_SEARCH",
      actorClass: "VISITOR",
      stage: "OCR",
      result: "SUCCESS",
      durationBucket: "LT_6S",
    } as const;
    expect(imageSearchTelemetryEventSchema.safeParse(base).success).toBe(true);
    for (const [key, value] of Object.entries(canaries))
      expect(
        imageSearchTelemetryEventSchema.safeParse({ ...base, [key]: value })
          .success,
      ).toBe(false);
  });
});
