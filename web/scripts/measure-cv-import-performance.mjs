import { readFile } from "node:fs/promises";
import os from "node:os";
import process from "node:process";

const SCHEMA_VERSION = "cv-import-performance-v1";
const SAFE_CODE = /^[A-Z][A-Z0-9_]*$/u;
const LATENCY_OPERATIONS = Object.freeze([
  "UPLOAD_FINALIZATION_PRE_SCAN",
  "QUEUE_TO_ACTIONABLE_TERMINAL",
  "STAGE_SCAN",
  "STAGE_EXTRACTION",
  "STAGE_PARSE",
  "REVIEW_LOAD",
  "DRAFT_SAVE",
  "CONFIRM",
]);
const CONDITIONS = Object.freeze(["COLD", "WARM"]);
const OUTCOMES = Object.freeze([
  "SUCCESS",
  "ACTIONABLE_REJECTION",
  "ERROR",
  "TIMEOUT",
]);
const RESOURCE_METRICS = Object.freeze([
  "SOURCE_DOCUMENT_BYTES",
  "EXTRACTED_TEXT_BYTES",
  "DRAFT_PAYLOAD_BYTES",
  "PROVENANCE_PAYLOAD_BYTES",
  "WORKER_RSS_BYTES",
  "WORKER_HEAP_BYTES",
]);
const REQUIRED_RESOURCE_METRICS = Object.freeze([
  "SOURCE_DOCUMENT_BYTES",
  "EXTRACTED_TEXT_BYTES",
  "DRAFT_PAYLOAD_BYTES",
  "PROVENANCE_PAYLOAD_BYTES",
  "WORKER_RSS_BYTES",
]);
const MANUAL_INTERVENTIONS = Object.freeze([
  "NONE",
  "PROCESS_RESTART",
  "OPERATOR_REQUEUE",
  "DATABASE_CHANGE",
  "STORAGE_CHANGE",
  "OTHER",
]);
const CLEANUP_OUTCOMES = Object.freeze(["COMPLETE", "FAILED", "PENDING"]);

const CLEANUP_DEFINITION = Object.freeze({
  observationUnit:
    "One synthetic CvUpload that becomes cleanup-eligible, including every source/extracted artifact and every draft/provenance database payload owned by that import.",
  denominator:
    "Every observation unit whose eligibleAt is inside the predeclared measurement window and whose maximum cleanup deadline is at or before the window end.",
  numerator:
    "Denominator units for which every required object is physically absent and every required database payload is scrubbed no later than deadlineAt, with manualIntervention=NONE.",
  measurementWindow:
    "The input window is fixed before aggregation. Units with a deadline after the window end are reported as censored and excluded; overdue pending/failed units remain in the denominator.",
  deadlineTreatment:
    "Completion exactly at deadlineAt passes. Completion after deadlineAt, or no completion by an elapsed deadline, fails.",
  manualIntervention:
    "Any process restart, operator requeue, database/storage mutation, or other operator action remains in the denominator and cannot enter the numerator.",
  targetPercent: 99,
});

const TARGETS = Object.freeze({
  UPLOAD_FINALIZATION_PRE_SCAN: Object.freeze({ p95Ms: 5_000 }),
  QUEUE_TO_ACTIONABLE_TERMINAL: Object.freeze({
    within60SecondsPercent: 90,
    allWithinMs: 180_000,
  }),
  REVIEW_LOAD: Object.freeze({ p95Ms: 3_000 }),
  DRAFT_SAVE: Object.freeze({ p95Ms: 2_000 }),
  CONFIRM: Object.freeze({ p95Ms: 2_000 }),
});

function fail(code) {
  throw new Error(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, code) {
  if (!isObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    fail(code);
  }
}

function assertEnum(value, allowed, code) {
  if (!allowed.includes(value)) fail(code);
  return value;
}

function assertInteger(value, minimum, code) {
  if (!Number.isInteger(value) || value < minimum) fail(code);
  return value;
}

function assertFiniteNumber(value, minimum, code) {
  if (!Number.isFinite(value) || value < minimum) fail(code);
  return value;
}

function assertIsoDate(value, code) {
  if (typeof value !== "string") fail(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(code);
  }
  return parsed;
}

function assertSafeCode(value, code) {
  if (typeof value !== "string" || !SAFE_CODE.test(value)) fail(code);
  return value;
}

function validateMetadata(metadata) {
  assertExactKeys(
    metadata,
    ["measurementWindow", "conditions", "dataset"],
    "CV_PERF_METADATA_INVALID",
  );
  assertExactKeys(
    metadata.measurementWindow,
    ["startedAt", "endedAt", "wallDurationMs", "clock"],
    "CV_PERF_WINDOW_INVALID",
  );
  const startedAt = assertIsoDate(
    metadata.measurementWindow.startedAt,
    "CV_PERF_WINDOW_INVALID",
  );
  const endedAt = assertIsoDate(
    metadata.measurementWindow.endedAt,
    "CV_PERF_WINDOW_INVALID",
  );
  if (endedAt <= startedAt) fail("CV_PERF_WINDOW_INVALID");
  assertFiniteNumber(
    metadata.measurementWindow.wallDurationMs,
    0,
    "CV_PERF_WINDOW_INVALID",
  );
  assertEnum(
    metadata.measurementWindow.clock,
    ["REALTIME", "CONTROLLED_RETENTION_CLOCK"],
    "CV_PERF_WINDOW_INVALID",
  );

  assertExactKeys(
    metadata.conditions,
    [
      "concurrency",
      "server",
      "scanner",
      "parser",
      "storage",
      "network",
      "coldWarm",
    ],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertInteger(
    metadata.conditions.concurrency,
    1,
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.server,
    ["NEXT_PRODUCTION", "NEXT_DEVELOPMENT", "ROUTE_HANDLER_HARNESS"],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.scanner,
    ["CLAMAV_UNIX_SOCKET", "CONTROLLED_FAKE"],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.parser,
    ["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI_APPROVED_SYNTHETIC"],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.storage,
    ["LOCAL_ENCRYPTED", "S3_PRIVATE_KMS"],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.network,
    ["LOOPBACK", "CONTROLLED_LAN", "EXTERNAL_PROVIDER"],
    "CV_PERF_CONDITIONS_INVALID",
  );
  assertEnum(
    metadata.conditions.coldWarm,
    ["ONE_COLD_REMAINDER_WARM", "ALL_COLD", "ALL_WARM"],
    "CV_PERF_CONDITIONS_INVALID",
  );

  assertExactKeys(
    metadata.dataset,
    ["documents", "pdf", "docx", "small", "medium", "large"],
    "CV_PERF_DATASET_INVALID",
  );
  const datasetValues = Object.values(metadata.dataset);
  datasetValues.forEach((value) =>
    assertInteger(value, 0, "CV_PERF_DATASET_INVALID"),
  );
  if (
    metadata.dataset.documents !==
      metadata.dataset.pdf + metadata.dataset.docx ||
    metadata.dataset.documents !==
      metadata.dataset.small +
        metadata.dataset.medium +
        metadata.dataset.large ||
    metadata.dataset.documents < 1
  ) {
    fail("CV_PERF_DATASET_INVALID");
  }
  return { startedAt, endedAt };
}

function validateLatency(observation) {
  assertExactKeys(
    observation,
    ["kind", "operation", "durationMs", "outcome", "resultCode", "condition"],
    "CV_PERF_LATENCY_OBSERVATION_INVALID",
  );
  assertEnum(
    observation.operation,
    LATENCY_OPERATIONS,
    "CV_PERF_LATENCY_OBSERVATION_INVALID",
  );
  assertFiniteNumber(
    observation.durationMs,
    0,
    "CV_PERF_LATENCY_OBSERVATION_INVALID",
  );
  assertEnum(
    observation.outcome,
    OUTCOMES,
    "CV_PERF_LATENCY_OBSERVATION_INVALID",
  );
  assertSafeCode(observation.resultCode, "CV_PERF_LATENCY_OBSERVATION_INVALID");
  assertEnum(
    observation.condition,
    CONDITIONS,
    "CV_PERF_LATENCY_OBSERVATION_INVALID",
  );
}

function validateResource(observation) {
  assertExactKeys(
    observation,
    ["kind", "metric", "valueBytes", "ceilingBytes", "condition"],
    "CV_PERF_RESOURCE_OBSERVATION_INVALID",
  );
  assertEnum(
    observation.metric,
    RESOURCE_METRICS,
    "CV_PERF_RESOURCE_OBSERVATION_INVALID",
  );
  assertInteger(
    observation.valueBytes,
    0,
    "CV_PERF_RESOURCE_OBSERVATION_INVALID",
  );
  assertInteger(
    observation.ceilingBytes,
    1,
    "CV_PERF_RESOURCE_OBSERVATION_INVALID",
  );
  assertEnum(
    observation.condition,
    CONDITIONS,
    "CV_PERF_RESOURCE_OBSERVATION_INVALID",
  );
}

function validateClaim(observation) {
  assertExactKeys(
    observation,
    [
      "kind",
      "durationMs",
      "concurrency",
      "successfulClaims",
      "duplicateClaims",
      "errors",
      "condition",
    ],
    "CV_PERF_CLAIM_OBSERVATION_INVALID",
  );
  assertFiniteNumber(
    observation.durationMs,
    0,
    "CV_PERF_CLAIM_OBSERVATION_INVALID",
  );
  for (const key of [
    "concurrency",
    "successfulClaims",
    "duplicateClaims",
    "errors",
  ]) {
    assertInteger(
      observation[key],
      key === "concurrency" ? 2 : 0,
      "CV_PERF_CLAIM_OBSERVATION_INVALID",
    );
  }
  assertEnum(
    observation.condition,
    CONDITIONS,
    "CV_PERF_CLAIM_OBSERVATION_INVALID",
  );
}

function validateCleanup(observation, window) {
  assertExactKeys(
    observation,
    [
      "kind",
      "eligibleAt",
      "deadlineAt",
      "completedAt",
      "outcome",
      "manualIntervention",
      "resultCode",
    ],
    "CV_PERF_CLEANUP_OBSERVATION_INVALID",
  );
  const eligibleAt = assertIsoDate(
    observation.eligibleAt,
    "CV_PERF_CLEANUP_OBSERVATION_INVALID",
  );
  const deadlineAt = assertIsoDate(
    observation.deadlineAt,
    "CV_PERF_CLEANUP_OBSERVATION_INVALID",
  );
  if (deadlineAt < eligibleAt) fail("CV_PERF_CLEANUP_OBSERVATION_INVALID");
  let completedAt = null;
  if (observation.completedAt !== null) {
    completedAt = assertIsoDate(
      observation.completedAt,
      "CV_PERF_CLEANUP_OBSERVATION_INVALID",
    );
    if (completedAt < eligibleAt) fail("CV_PERF_CLEANUP_OBSERVATION_INVALID");
  }
  assertEnum(
    observation.outcome,
    CLEANUP_OUTCOMES,
    "CV_PERF_CLEANUP_OBSERVATION_INVALID",
  );
  assertEnum(
    observation.manualIntervention,
    MANUAL_INTERVENTIONS,
    "CV_PERF_CLEANUP_OBSERVATION_INVALID",
  );
  assertSafeCode(observation.resultCode, "CV_PERF_CLEANUP_OBSERVATION_INVALID");
  if (
    (observation.outcome === "COMPLETE") !== (completedAt !== null) ||
    (observation.outcome === "PENDING" &&
      deadlineAt <= window.endedAt &&
      completedAt)
  ) {
    fail("CV_PERF_CLEANUP_OBSERVATION_INVALID");
  }
  return { eligibleAt, deadlineAt, completedAt };
}

function validateInput(input) {
  assertExactKeys(
    input,
    ["schemaVersion", "mode", "metadata", "observations"],
    "CV_PERF_INPUT_INVALID",
  );
  if (input.schemaVersion !== SCHEMA_VERSION)
    fail("CV_PERF_SCHEMA_UNSUPPORTED");
  assertEnum(input.mode, ["MEASURED", "SELF_TEST"], "CV_PERF_MODE_INVALID");
  const window = validateMetadata(input.metadata);
  if (!Array.isArray(input.observations) || input.observations.length === 0) {
    fail("CV_PERF_OBSERVATIONS_REQUIRED");
  }
  const cleanupTimes = new Map();
  input.observations.forEach((observation, index) => {
    if (!isObject(observation)) fail("CV_PERF_OBSERVATION_INVALID");
    switch (observation.kind) {
      case "LATENCY":
        validateLatency(observation);
        break;
      case "RESOURCE":
        validateResource(observation);
        break;
      case "CLAIM":
        validateClaim(observation);
        break;
      case "CLEANUP":
        cleanupTimes.set(index, validateCleanup(observation, window));
        break;
      default:
        fail("CV_PERF_OBSERVATION_KIND_INVALID");
    }
  });
  return { window, cleanupTimes };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function round(value) {
  return value === null ? null : Number(value.toFixed(2));
}

function summarizeDurations(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return Object.freeze({
    samples: sorted.length,
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    maximumMs: round(sorted.at(-1) ?? null),
  });
}

function summarizeLatency(observations) {
  return LATENCY_OPERATIONS.map((operation) => {
    const samples = observations.filter(
      (entry) => entry.kind === "LATENCY" && entry.operation === operation,
    );
    const durations = summarizeDurations(
      samples.map((entry) => entry.durationMs),
    );
    const errors = samples.filter((entry) =>
      ["ERROR", "TIMEOUT"].includes(entry.outcome),
    ).length;
    const result = {
      operation,
      ...durations,
      coldSamples: samples.filter((entry) => entry.condition === "COLD").length,
      warmSamples: samples.filter((entry) => entry.condition === "WARM").length,
      errorCount: errors,
      errorRatePercent:
        samples.length === 0 ? null : round((errors / samples.length) * 100),
      resultCodes: [
        ...new Set(samples.map((entry) => entry.resultCode)),
      ].sort(),
    };
    const target = TARGETS[operation];
    if (target?.p95Ms !== undefined) {
      return {
        ...result,
        target,
        passed:
          samples.length > 0 && errors === 0 && result.p95Ms <= target.p95Ms,
      };
    }
    if (operation === "QUEUE_TO_ACTIONABLE_TERMINAL") {
      const completedWithin60Seconds = samples.filter(
        (entry) =>
          !["ERROR", "TIMEOUT"].includes(entry.outcome) &&
          entry.durationMs <= 60_000,
      ).length;
      const within60SecondsPercent =
        samples.length === 0
          ? null
          : round((completedWithin60Seconds / samples.length) * 100);
      return {
        ...result,
        within60SecondsPercent,
        target,
        passed:
          samples.length > 0 &&
          within60SecondsPercent >= target.within60SecondsPercent &&
          errors === 0 &&
          result.maximumMs <= target.allWithinMs,
      };
    }
    return {
      ...result,
      target: null,
      passed: samples.length > 0 && errors === 0,
    };
  });
}

function summarizeResources(observations) {
  return RESOURCE_METRICS.map((metric) => {
    const samples = observations.filter(
      (entry) => entry.kind === "RESOURCE" && entry.metric === metric,
    );
    const maximumValueBytes = Math.max(
      ...samples.map((entry) => entry.valueBytes),
      0,
    );
    const minimumCeilingBytes = Math.min(
      ...samples.map((entry) => entry.ceilingBytes),
      Number.POSITIVE_INFINITY,
    );
    return {
      metric,
      samples: samples.length,
      maximumValueBytes,
      minimumCeilingBytes:
        minimumCeilingBytes === Number.POSITIVE_INFINITY
          ? null
          : minimumCeilingBytes,
      passed:
        samples.length > 0 &&
        samples.every((entry) => entry.valueBytes <= entry.ceilingBytes),
    };
  });
}

function summarizeClaims(observations) {
  const samples = observations.filter((entry) => entry.kind === "CLAIM");
  return {
    ...summarizeDurations(samples.map((entry) => entry.durationMs)),
    maximumConcurrency: Math.max(
      ...samples.map((entry) => entry.concurrency),
      0,
    ),
    successfulClaims: samples.reduce(
      (total, entry) => total + entry.successfulClaims,
      0,
    ),
    duplicateClaims: samples.reduce(
      (total, entry) => total + entry.duplicateClaims,
      0,
    ),
    errors: samples.reduce((total, entry) => total + entry.errors, 0),
    passed:
      samples.length > 0 &&
      samples.every(
        (entry) =>
          entry.successfulClaims === 1 &&
          entry.duplicateClaims === 0 &&
          entry.errors === 0,
      ),
  };
}

function summarizeCleanup(input, validated) {
  const observations = input.observations
    .map((entry, index) => ({
      entry,
      times: validated.cleanupTimes.get(index),
    }))
    .filter(({ entry }) => entry.kind === "CLEANUP");
  const denominator = observations.filter(
    ({ times }) =>
      times.eligibleAt >= validated.window.startedAt &&
      times.eligibleAt <= validated.window.endedAt &&
      times.deadlineAt <= validated.window.endedAt,
  );
  const censored = observations.length - denominator.length;
  const successful = denominator.filter(
    ({ entry, times }) =>
      entry.outcome === "COMPLETE" &&
      entry.manualIntervention === "NONE" &&
      times.completedAt <= times.deadlineAt,
  );
  const turnaroundDurations = denominator
    .filter(({ times }) => times.completedAt !== null)
    .map(({ times }) => times.completedAt - times.eligibleAt);
  const deadlineOverruns = denominator
    .filter(({ times }) => times.completedAt !== null)
    .map(({ times }) => Math.max(0, times.completedAt - times.deadlineAt));
  const successPercent =
    denominator.length === 0
      ? null
      : round((successful.length / denominator.length) * 100);
  return {
    definition: CLEANUP_DEFINITION,
    observedUnits: observations.length,
    denominatorUnits: denominator.length,
    numeratorUnits: successful.length,
    censoredUnits: censored,
    manualInterventionUnits: denominator.filter(
      ({ entry }) => entry.manualIntervention !== "NONE",
    ).length,
    overdueOrFailedUnits: denominator.length - successful.length,
    successPercent,
    turnaround: summarizeDurations(turnaroundDurations),
    deadlineOverrun: summarizeDurations(deadlineOverruns),
    resultCodes: [
      ...new Set(denominator.map(({ entry }) => entry.resultCode)),
    ].sort(),
    passed:
      denominator.length > 0 &&
      successPercent >= CLEANUP_DEFINITION.targetPercent,
  };
}

function buildReleaseQualification(conditions) {
  const requiredConditions = Object.freeze({
    server: "NEXT_PRODUCTION",
    scanner: "CLAMAV_UNIX_SOCKET",
    parser: "EXTERNAL_OPENAI_APPROVED_SYNTHETIC",
    storage: "S3_PRIVATE_KMS",
    network: "EXTERNAL_PROVIDER",
  });
  const satisfied = Object.fromEntries(
    Object.entries(requiredConditions).map(([name, required]) => [
      name,
      conditions[name] === required,
    ]),
  );
  return {
    requiredConditions,
    satisfied,
    passed: Object.values(satisfied).every(Boolean),
  };
}

function buildReport(input, validated) {
  const latency = summarizeLatency(input.observations);
  const resources = summarizeResources(input.observations);
  const claims = summarizeClaims(input.observations);
  const cleanup = summarizeCleanup(input, validated);
  const requiredResourcesPresent = REQUIRED_RESOURCE_METRICS.every((metric) =>
    resources.some((entry) => entry.metric === metric && entry.samples > 0),
  );
  const coverage = {
    latencyOperations:
      latency.filter((entry) => entry.samples > 0).length ===
      LATENCY_OPERATIONS.length,
    requiredResources: requiredResourcesPresent,
    concurrentClaims: claims.samples > 0,
    cleanup: cleanup.observedUnits > 0 && cleanup.denominatorUnits > 0,
  };
  const gatedLatency = latency.filter((entry) => TARGETS[entry.operation]);
  const passed =
    Object.values(coverage).every(Boolean) &&
    gatedLatency.every((entry) => entry.passed) &&
    resources
      .filter((entry) => REQUIRED_RESOURCE_METRICS.includes(entry.metric))
      .every((entry) => entry.passed) &&
    claims.passed &&
    cleanup.passed;
  const releaseQualification = buildReleaseQualification(
    input.metadata.conditions,
  );
  const cpu = os.cpus()[0];
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: input.mode,
    releaseEvidenceEligible: input.mode === "MEASURED",
    measuredTargetGatePassed: input.mode === "MEASURED" && passed,
    releaseQualification,
    releaseGatePassed:
      input.mode === "MEASURED" && passed && releaseQualification.passed,
    percentileMethod:
      "Nearest-rank: sort ascending and select ceil(sampleCount * percentile), one-based.",
    recordedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: cpu?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    measurement: {
      ...input.metadata,
      controlledTimelineDurationMs:
        validated.window.endedAt - validated.window.startedAt,
      observationCount: input.observations.length,
    },
    cleanupDefinitionCommittedBeforeAggregation: CLEANUP_DEFINITION,
    coverage,
    latency,
    resources,
    concurrentClaims: claims,
    cleanup,
    passed,
  };
}

function createSelfTestInput() {
  const startedAt = Date.parse("2026-01-01T00:00:00.000Z");
  const iso = (offsetMs) => new Date(startedAt + offsetMs).toISOString();
  const observations = [];
  for (const operation of LATENCY_OPERATIONS) {
    observations.push({
      kind: "LATENCY",
      operation,
      durationMs:
        operation === "QUEUE_TO_ACTIONABLE_TERMINAL"
          ? 20_000
          : operation.startsWith("STAGE_")
            ? 500
            : 100,
      outcome: "SUCCESS",
      resultCode: "CV_SYNTHETIC_OK",
      condition: "COLD",
    });
    observations.push({
      kind: "LATENCY",
      operation,
      durationMs:
        operation === "QUEUE_TO_ACTIONABLE_TERMINAL"
          ? 10_000
          : operation.startsWith("STAGE_")
            ? 250
            : 50,
      outcome: "SUCCESS",
      resultCode: "CV_SYNTHETIC_OK",
      condition: "WARM",
    });
  }
  for (const metric of REQUIRED_RESOURCE_METRICS) {
    observations.push({
      kind: "RESOURCE",
      metric,
      valueBytes: 1_024,
      ceilingBytes: 2_048,
      condition: "WARM",
    });
  }
  observations.push({
    kind: "CLAIM",
    durationMs: 25,
    concurrency: 8,
    successfulClaims: 1,
    duplicateClaims: 0,
    errors: 0,
    condition: "WARM",
  });
  observations.push({
    kind: "CLEANUP",
    eligibleAt: iso(1_000),
    deadlineAt: iso(5_000),
    completedAt: iso(4_000),
    outcome: "COMPLETE",
    manualIntervention: "NONE",
    resultCode: "CV_CLEANUP_COMPLETE",
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: "SELF_TEST",
    metadata: {
      measurementWindow: {
        startedAt: iso(0),
        endedAt: iso(10_000),
        wallDurationMs: 10_000,
        clock: "REALTIME",
      },
      conditions: {
        concurrency: 8,
        server: "ROUTE_HANDLER_HARNESS",
        scanner: "CONTROLLED_FAKE",
        parser: "DETERMINISTIC_INTERNAL",
        storage: "LOCAL_ENCRYPTED",
        network: "LOOPBACK",
        coldWarm: "ONE_COLD_REMAINDER_WARM",
      },
      dataset: {
        documents: 2,
        pdf: 1,
        docx: 1,
        small: 2,
        medium: 0,
        large: 0,
      },
    },
    observations,
  };
}

function usage() {
  return [
    "Usage:",
    "  npm run perf:cv-import -- --input <content-free-observations.json>",
    "  npm run perf:cv-import -- --self-test",
    "",
    "The input is strict and accepts only aggregate-safe timing, resource, claim,",
    "cleanup, format-count, and size-bucket fields. SELF_TEST output is never",
    "eligible for release evidence.",
  ].join("\n");
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--self-test") {
    return { selfTest: true, inputPath: null };
  }
  const inputIndex = argv.indexOf("--input");
  if (inputIndex >= 0 && inputIndex === argv.length - 2 && argv.length === 2) {
    return { selfTest: false, inputPath: argv[inputIndex + 1] };
  }
  process.stderr.write(`${usage()}\n`);
  fail("CV_PERF_ARGUMENTS_INVALID");
}

const arguments_ = parseArguments(process.argv.slice(2));
const input = arguments_.selfTest
  ? createSelfTestInput()
  : JSON.parse(await readFile(arguments_.inputPath, "utf8"));
const validated = validateInput(input);
const report = buildReport(input, validated);

process.stdout.write(
  `CV_IMPORT_PERFORMANCE_RESULT\n${JSON.stringify(report, null, 2)}\n`,
);

if (!report.passed) {
  fail(
    input.mode === "MEASURED"
      ? "CV_IMPORT_PERFORMANCE_GATE_FAILED"
      : "CV_IMPORT_PERFORMANCE_SELF_TEST_FAILED",
  );
}
