import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  OCR_ENGINE_NAMES,
  OCR_MODEL_NAMES,
  OCR_PURPOSES,
  OCR_RESULT_MAX_LINES,
  OCR_RESULT_MAX_UTF8_BYTES,
  ocrRecognitionResultSchema,
} from "@/shared/contracts/ocr/recognition";
import {
  CV_SEGMENT_SCHEMA_VERSION,
  cvSegmentV2Schema,
} from "@/shared/contracts/ocr/cv-segments-v2";
import {
  IMAGE_SEARCH_ALLOWED_FIELDS,
  SEARCH_INTENT_SCHEMA_VERSION,
  searchIntentSchema,
} from "@/shared/contracts/jobs/search-intent";

const contracts = resolve(
  process.cwd(),
  "../spec-kit/specs/005-ocr-parsing/contracts",
);

describe("Feature 005 cross-artifact contract parity", () => {
  it("keeps OCR OpenAPI, TypeScript, and Pydantic constants identical", async () => {
    const [openapi, python] = await Promise.all([
      readFile(resolve(contracts, "ocr-engine.openapi.yaml"), "utf8"),
      readFile(
        resolve(process.cwd(), "../ocr-engine/src/contracts.py"),
        "utf8",
      ),
    ]);
    expect(OCR_PURPOSES).toEqual(["CV_IMPORT", "JOB_IMAGE_SEARCH"]);
    expect(OCR_ENGINE_NAMES).toEqual(["paddleocr-onnx"]);
    expect(OCR_MODEL_NAMES).toEqual(["PP-OCRv6-medium"]);
    expect(OCR_RESULT_MAX_LINES).toBe(2_000);
    expect(OCR_RESULT_MAX_UTF8_BYTES).toBe(65_536);
    for (const value of [
      ...OCR_PURPOSES,
      ...OCR_ENGINE_NAMES,
      ...OCR_MODEL_NAMES,
      "ocr-lines-v1",
      "1.27.0",
      "2000",
      "65536",
    ]) {
      expect(openapi, value).toContain(value);
      expect(python, value).toContain(value);
    }
  });

  it("keeps CV v2 schema versions, enums, and strict unknown-field rules identical", async () => {
    const schema = JSON.parse(
      await readFile(resolve(contracts, "cv-segments-v2.schema.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(CV_SEGMENT_SCHEMA_VERSION).toBe("cv-segments-v2");
    expect(JSON.stringify(schema)).toContain(CV_SEGMENT_SCHEMA_VERSION);
    expect(JSON.stringify(schema)).toContain('additionalProperties":false');
    expect(
      cvSegmentV2Schema.safeParse({
        schemaVersion: "cv-segments-v2",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("keeps search-intent fields and bounds identical without workflow assertions", async () => {
    const schemaText = await readFile(
      resolve(contracts, "search-intent.schema.json"),
      "utf8",
    );
    expect(SEARCH_INTENT_SCHEMA_VERSION).toBe("job-search-intent-v1");
    for (const field of IMAGE_SEARCH_ALLOWED_FIELDS) {
      expect(schemaText, field).toContain(`"${field}"`);
    }
    for (const prohibited of ["jobId", "sort", "cursor", "ranking", "score"]) {
      expect(IMAGE_SEARCH_ALLOWED_FIELDS).not.toContain(prohibited);
    }
    expect(
      searchIntentSchema.safeParse({
        schemaVersion: SEARCH_INTENT_SCHEMA_VERSION,
        language: "VI",
        proposals: [],
        warnings: [],
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown recognition result fields", () => {
    expect(
      ocrRecognitionResultSchema.safeParse({
        schemaVersion: "ocr-lines-v1",
        unexpected: "content",
      }).success,
    ).toBe(false);
  });
});
