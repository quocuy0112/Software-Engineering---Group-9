import { describe, expect, it } from "vitest";

import {
  buildCvLogEvent,
  buildCvMetricEvent,
  buildCvTraceEvent,
  serializeSafeCvException,
} from "@/backend/cv/telemetry";

const canaries = {
  cvBytes: "JVBERi0xLjQKc2VjcmV0",
  cvText: "Synthetic secret employment narrative",
  filename: "private-candidate-name.pdf",
  email: "private-person@example.invalid",
  phone: "+10000000000",
  url: "https://private.example.invalid/profile",
  digest: "a".repeat(64),
  hmac: "b".repeat(64),
  locator: "private/random/object-locator",
  keyVersion: "key-version-42",
  consentText: "I agree to send this exact CV externally",
  prompt: "system prompt secret",
  response: "provider raw response secret",
  token: "sk-fixture-token-never-log",
  session: "session_fixture_never_log",
  scannerError: "raw clamd response echoed a filename",
  providerError: "raw provider body echoed CV text",
};

function expectNoCanary(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const canary of Object.values(canaries)) {
    expect(serialized).not.toContain(canary);
  }
}

describe("CV telemetry allowlist and redaction", () => {
  it("builds logs only from safe state/version/correlation fields", () => {
    const event = buildCvLogEvent({
      event: "cv.stage.completed",
      stage: "SCAN",
      state: "CLEAN",
      resultCode: "CLEAN",
      requestId: "request_fixture",
      uploadId: "upload_fixture",
      durationBucket: "1s-5s",
      parserClass: "DETERMINISTIC_INTERNAL",
      schemaVersion: "cv-draft-v1",
    });
    expect(event).toMatchObject({ stage: "SCAN", state: "CLEAN" });
    expectNoCanary(event);
    expect(() =>
      buildCvLogEvent({
        event: "cv.stage.completed",
        stage: "SCAN",
        state: "CLEAN",
        ...canaries,
      } as never),
    ).toThrow("CV_TELEMETRY_FIELD_FORBIDDEN");
  });

  it("builds metric dimensions without content cardinality", () => {
    const metric = buildCvMetricEvent({
      metric: "cv_stage_duration_ms",
      value: 125,
      dimensions: {
        stage: "PARSE",
        state: "SUCCEEDED",
        parserClass: "DETERMINISTIC_INTERNAL",
        durationBucket: "100ms-500ms",
      },
    });
    expect(metric.value).toBe(125);
    expectNoCanary(metric);
    expect(() =>
      buildCvMetricEvent({
        metric: "cv_stage_duration_ms",
        value: 1,
        dimensions: { filename: canaries.filename },
      } as never),
    ).toThrow("CV_TELEMETRY_FIELD_FORBIDDEN");
  });

  it("maps nested provider/scanner exceptions to a safe code only", () => {
    const error = new Error(canaries.providerError, {
      cause: {
        ...canaries,
        request: { headers: { authorization: canaries.token } },
      },
    });
    Object.assign(error, canaries);
    const safe = serializeSafeCvException(error, "PARSER_UNAVAILABLE");
    expect(safe).toEqual({ code: "PARSER_UNAVAILABLE" });
    expectNoCanary(safe);
  });

  it("builds trace attributes from the same bounded operational allowlist", () => {
    const trace = buildCvTraceEvent({
      name: "cv.stage.outcome",
      attributes: { stage: "PARSE", state: "SUCCEEDED" },
    });
    expectNoCanary(trace);
    expect(() =>
      buildCvTraceEvent({
        name: "cv.stage.outcome",
        attributes: { prompt: canaries.prompt },
      } as never),
    ).toThrow("CV_TELEMETRY_FIELD_FORBIDDEN");
  });
});
