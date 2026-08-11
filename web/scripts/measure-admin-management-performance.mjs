import { readFile } from "node:fs/promises";
import { cpus, freemem, platform, release, totalmem } from "node:os";
import { performance } from "node:perf_hooks";

export function percentile(values, ratio) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[
    Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)
  ];
}

export function distribution(values) {
  return {
    sampleCount: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: values.length ? Math.max(...values) : null,
  };
}

export function evaluate(samples, errors) {
  const durations = samples.map((sample) => sample.durationMs);
  const total = samples.length + errors;
  return {
    ...distribution(durations),
    errorCount: errors,
    errorRate: total ? errors / total : 1,
    usableWithinTwoSecondsRate: samples.length
      ? durations.filter((value) => value <= 2_000).length / samples.length
      : 0,
  };
}

export function evaluateReliability(records) {
  const deliveries = records.filter(
    (record) => record.type === "emailDelivery",
  );
  const sessionEnforcement = records.filter(
    (record) => record.type === "sessionEnforcement",
  );
  const providerLatencies = deliveries.flatMap(
    (record) => record.providerLatencyMs,
  );
  const retryCountByEventKind = {};
  for (const delivery of deliveries) {
    retryCountByEventKind[delivery.eventKind] =
      (retryCountByEventKind[delivery.eventKind] ?? 0) + delivery.retryCount;
  }
  const commitToSent = deliveries
    .filter((record) => record.finalOutboxStatus === "SENT")
    .map((record) => record.commitToSentMs);
  const manualCount = deliveries.filter(
    (record) => record.finalWorkStatus === "MANUAL_INTERVENTION_REQUIRED",
  ).length;
  const enforcementDurations = sessionEnforcement.map(
    (record) => record.durationMs,
  );
  return {
    deliveryCount: deliveries.length,
    providerLatency: distribution(providerLatencies),
    retryCountByEventKind,
    manualInterventionRequiredCount: manualCount,
    manualInterventionRequiredRate: deliveries.length
      ? manualCount / deliveries.length
      : 0,
    commitToSent: {
      sampleCount: commitToSent.length,
      meanMs: commitToSent.length
        ? commitToSent.reduce((total, value) => total + value, 0) /
          commitToSent.length
        : null,
      ...distribution(commitToSent),
    },
    sessionEnforcement: {
      ...distribution(enforcementDurations),
      withinTwoSecondsRate: sessionEnforcement.length
        ? sessionEnforcement.filter(
            (record) => record.enforced && record.durationMs <= 2_000,
          ).length / sessionEnforcement.length
        : 0,
    },
  };
}

export async function readReliabilityEvidence(path) {
  const source = await readFile(path, "utf8");
  return source
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runtimeDescription() {
  return {
    platform: `${platform()} ${release()}`,
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytesAtStart: freemem(),
    nodeVersion: process.version,
  };
}

function selfTestRecords() {
  return [
    {
      type: "emailDelivery",
      eventKind: "ACCOUNT_SUSPENDED",
      providerLatencyMs: [11],
      retryCount: 0,
      finalOutboxStatus: "SENT",
      finalWorkStatus: "DELIVERED",
      commitToSentMs: 31,
    },
    {
      type: "emailDelivery",
      eventKind: "VERIFICATION_APPROVED",
      providerLatencyMs: [13, 17, 12],
      retryCount: 2,
      finalOutboxStatus: "SENT",
      finalWorkStatus: "DELIVERED",
      commitToSentMs: 51,
    },
    {
      type: "emailDelivery",
      eventKind: "ACCOUNT_SUSPENDED",
      providerLatencyMs: [9, 10, 12, 11, 14],
      retryCount: 4,
      finalOutboxStatus: "DEAD",
      finalWorkStatus: "MANUAL_INTERVENTION_REQUIRED",
      commitToSentMs: null,
    },
    {
      type: "sessionEnforcement",
      eventKind: "ACCOUNT_SUSPENDED",
      durationMs: 125,
      enforced: true,
    },
  ];
}

function parseAdministratorCookies() {
  const encoded = process.env.ADMIN_PERF_AUTH_COOKIES;
  if (encoded) {
    const cookies = JSON.parse(encoded);
    if (!Array.isArray(cookies) || cookies.some((cookie) => !cookie))
      throw new Error("ADMIN_PERF_AUTH_COOKIES must be a JSON string array");
    return cookies;
  }
  return process.env.ADMIN_PERF_AUTH_COOKIE
    ? [process.env.ADMIN_PERF_AUTH_COOKIE]
    : [];
}

async function measure() {
  if (process.argv.includes("--self-test")) {
    const dashboard = evaluate(
      Array.from({ length: 100 }, (_, index) => ({
        durationMs: index < 96 ? 250 : 1_900,
      })),
      0,
    );
    const reliability = evaluateReliability(selfTestRecords());
    if (
      dashboard.usableWithinTwoSecondsRate < 0.95 ||
      dashboard.errorRate >= 0.01 ||
      reliability.sessionEnforcement.withinTwoSecondsRate !== 1
    )
      process.exitCode = 1;
    console.log(
      JSON.stringify({ mode: "self-test", dashboard, reliability }, null, 2),
    );
    return;
  }

  if (process.argv.includes("--reliability-only")) {
    const evidencePath = process.env.ADMIN_PERF_RELIABILITY_EVIDENCE;
    if (!evidencePath)
      throw new Error("ADMIN_PERF_RELIABILITY_EVIDENCE is required");
    const reliability = evaluateReliability(
      await readReliabilityEvidence(evidencePath),
    );
    console.log(
      JSON.stringify(
        {
          mode: "e2e-reliability",
          measuredAt: new Date().toISOString(),
          evidencePath,
          reliability,
        },
        null,
        2,
      ),
    );
    if (
      reliability.deliveryCount === 0 ||
      reliability.providerLatency.sampleCount === 0 ||
      reliability.sessionEnforcement.sampleCount === 0 ||
      reliability.sessionEnforcement.withinTwoSecondsRate !== 1
    )
      process.exitCode = 1;
    return;
  }

  const origin = process.env.ADMIN_PERF_ORIGIN;
  const cookies = parseAdministratorCookies();
  if (!origin || cookies.length !== 10)
    throw new Error(
      "ADMIN_PERF_ORIGIN and exactly 10 cookies in ADMIN_PERF_AUTH_COOKIES are required",
    );
  const evidencePath = process.env.ADMIN_PERF_RELIABILITY_EVIDENCE;
  if (!evidencePath)
    throw new Error("ADMIN_PERF_RELIABILITY_EVIDENCE is required");
  const durationMs = Number(process.env.ADMIN_PERF_DURATION_MS ?? 15 * 60_000);
  const requestIntervalMs = Number(
    process.env.ADMIN_PERF_REQUEST_INTERVAL_MS ?? 1_000,
  );
  const concurrency = 10;
  const paths = [
    "/api/admin/dashboard",
    "/api/admin/accounts?page=1&perPage=25&filter=%7B%7D",
    "/api/admin/company-memberships?page=1&perPage=25&filter=%7B%7D",
    "/api/admin/verification-requests?page=1&perPage=25&filter=%7B%7D",
    "/api/admin/moderation-reports?page=1&perPage=25&filter=%7B%7D",
  ];
  const deadline = Date.now() + durationMs;
  const samples = [];
  let errors = 0;
  const errorsByCategory = {};

  await Promise.all(
    cookies.map(async (cookie, worker) => {
      let index = worker;
      while (Date.now() < deadline) {
        const iterationStartedAt = Date.now();
        const started = performance.now();
        try {
          const response = await fetch(
            new URL(paths[index % paths.length], origin),
            {
              headers: { cookie, accept: "application/json", origin },
              cache: "no-store",
            },
          );
          if (!response.ok) throw new Error(`HTTP_${response.status}`);
          await response.arrayBuffer();
          samples.push({
            path: paths[index % paths.length],
            durationMs: performance.now() - started,
          });
        } catch (error) {
          errors += 1;
          const category =
            error instanceof Error && /^HTTP_\d+$/u.test(error.message)
              ? error.message
              : "NETWORK_OR_RUNTIME_ERROR";
          errorsByCategory[category] = (errorsByCategory[category] ?? 0) + 1;
        }
        index += concurrency;
        const waitMs = requestIntervalMs - (Date.now() - iterationStartedAt);
        if (waitMs > 0)
          await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }),
  );

  const dashboard = evaluate(samples, errors);
  const reliability = evaluateReliability(
    await readReliabilityEvidence(evidencePath),
  );
  const result = {
    measuredAt: new Date().toISOString(),
    durationMs,
    requestIntervalMs,
    concurrentAdministratorCount: cookies.length,
    runtime: runtimeDescription(),
    requiredDataset: {
      accounts: 10_000,
      companies: 1_000,
      memberships: 5_000,
      openReviewItems: 1_000,
    },
    dashboard: { ...dashboard, errorsByCategory },
    reliability,
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    dashboard.usableWithinTwoSecondsRate < 0.95 ||
    dashboard.p95Ms > 2_000 ||
    dashboard.errorRate >= 0.01 ||
    reliability.sessionEnforcement.withinTwoSecondsRate !== 1
  )
    process.exitCode = 1;
}

await measure();
