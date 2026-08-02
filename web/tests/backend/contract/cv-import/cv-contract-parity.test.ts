import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CV_API_ERROR_CODES,
  CV_PARSER_CLASSES,
  CV_REVIEW_ACTIONS,
  CV_SOURCE_MAX_BYTES,
  CV_UPLOAD_STATUSES,
  canonicalJsonBytes,
  cvApiErrorSchema,
  cvIdempotencyKeySchema,
} from "@/shared/contracts/cv-import/common";
import {
  CV_DRAFT_MAX_BYTES,
  CV_PROVENANCE_MAX_BYTES,
  cvParserOutputSchema,
  validateParserEvidenceMembership,
} from "@/shared/contracts/cv-import/parser-output";
import { buildCvFixtureParserOutput } from "../../../helpers/cv-import-fixture";

const openApiPath = resolve(
  process.cwd(),
  "../spec-kit/specs/004-cv-upload-parse-review/contracts/openapi.yaml",
);

describe("Feature 004 contract parity", () => {
  it("keeps reviewed constants and enums present in OpenAPI", async () => {
    const openApi = await readFile(openApiPath, "utf8");
    expect(CV_SOURCE_MAX_BYTES).toBe(5_000_000);
    expect(CV_DRAFT_MAX_BYTES).toBe(256 * 1024);
    expect(CV_PROVENANCE_MAX_BYTES).toBe(128 * 1024);
    for (const value of [
      ...CV_PARSER_CLASSES,
      ...CV_UPLOAD_STATUSES,
      ...CV_REVIEW_ACTIONS,
      ...CV_API_ERROR_CODES,
    ]) {
      expect(openApi, value).toContain(value);
    }
    expect(openApi).toContain("maximum: 5000000");
  });

  it("rejects unknown parser and API response properties", () => {
    expect(
      cvParserOutputSchema.safeParse({
        ...buildCvFixtureParserOutput(),
        rawText: "must not survive",
      }).success,
    ).toBe(false);
    expect(
      cvApiErrorSchema.safeParse({
        error: {
          code: "VALIDATION_ERROR",
          message: "Review the highlighted fields.",
          requestId: "request_fixture",
          fieldErrors: [],
          latest: null,
          rejectedValue: "must not survive",
        },
      }).success,
    ).toBe(false);
  });

  it("uses strict idempotency keys and canonical UTF-8 byte accounting", () => {
    expect(
      cvIdempotencyKeySchema.safeParse("fixture-key_1234567890").success,
    ).toBe(true);
    expect(cvIdempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(cvIdempotencyKeySchema.safeParse("x".repeat(129)).success).toBe(
      false,
    );
    expect(canonicalJsonBytes({ b: "á", a: 1 })).toBe(
      new TextEncoder().encode('{"a":1,"b":"á"}').byteLength,
    );
  });

  it("validates cv-draft-v1 as a whole and enforces evidence membership", () => {
    const output = buildCvFixtureParserOutput();
    expect(cvParserOutputSchema.parse(output)).toEqual(output);
    expect(
      validateParserEvidenceMembership(
        output,
        new Set([
          "segment-heading-1",
          "segment-experience-1",
          "segment-skill-1",
        ]),
      ),
    ).toBe(true);
    expect(
      validateParserEvidenceMembership(output, new Set(["segment-heading-1"])),
    ).toBe(false);
  });
});
