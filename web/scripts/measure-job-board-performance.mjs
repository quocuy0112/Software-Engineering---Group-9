import os from "node:os";
import process from "node:process";

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3001";
const iterations = Number.parseInt(process.env.PERF_ITERATIONS ?? "100", 10);
const jobSlug = process.env.PERF_JOB_SLUG;
const jobId = process.env.PERF_JOB_ID;
const sessionCookie = process.env.PERF_SESSION_COOKIE;
const csrfToken = process.env.PERF_CSRF_TOKEN;
const budgetMs = 2_000;

if (!Number.isInteger(iterations) || iterations < 10)
  throw new Error("PERF_ITERATIONS must be an integer of at least 10");
for (const [name, value] of Object.entries({
  PERF_JOB_SLUG: jobSlug,
  PERF_JOB_ID: jobId,
  PERF_SESSION_COOKIE: sessionCookie,
  PERF_CSRF_TOKEN: csrfToken,
})) {
  if (!value) throw new Error(`${name} is required`);
}

function percentile(sorted, fraction) {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function summary(name, values) {
  const sorted = [...values].sort((left, right) => left - right);
  const result = {
    name,
    samples: values.length,
    p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
    maxMs: Number(sorted.at(-1).toFixed(2)),
    budgetMs,
  };
  return { ...result, passed: result.p95Ms <= budgetMs };
}

async function timedRequest(path, init, expectedStatuses) {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  await response.arrayBuffer();
  if (!expectedStatuses.includes(response.status))
    throw new Error(`PERFORMANCE_REQUEST_FAILED:${path}:${response.status}`);
  return performance.now() - startedAt;
}

async function samples(action) {
  await action(-1);
  const values = [];
  for (let index = 0; index < iterations; index += 1)
    values.push(await action(index));
  return values;
}

const search = summary(
  "job-search",
  await samples(() =>
    timedRequest(
      "/api/jobs?q=typescript&location=ho%20chi%20minh&sort=RELEVANCE&limit=20",
      { headers: { accept: "application/json" } },
      [200],
    ),
  ),
);
const detail = summary(
  "job-detail",
  await samples(() =>
    timedRequest(
      `/api/jobs/${encodeURIComponent(jobSlug)}`,
      { headers: { accept: "application/json" } },
      [200],
    ),
  ),
);
const action = summary(
  "save-remove-action",
  await samples((index) =>
    timedRequest(
      `/api/saved-jobs/${encodeURIComponent(jobId)}`,
      {
        method: index % 2 === 0 ? "PUT" : "DELETE",
        headers: {
          cookie: sessionCookie,
          "x-csrf-token": csrfToken,
          origin: baseUrl,
          "sec-fetch-site": "same-origin",
        },
      },
      [200],
    ),
  ),
);

const checks = [search, detail, action];
const output = {
  recordedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    logicalCpuCount: os.cpus().length,
    totalMemoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    baseUrl,
    serverMode: "externally managed production build",
    warmupsPerClass: 1,
  },
  dataset: {
    searchCriteria: "typescript + ho chi minh",
    jobSlugProvided: true,
    authenticatedSaveTargetProvided: true,
  },
  checks,
  passed: checks.every((check) => check.passed),
};

process.stdout.write(
  `\nJOB_BOARD_PERFORMANCE_RESULT\n${JSON.stringify(output, null, 2)}\n`,
);
if (!output.passed) throw new Error("JOB_BOARD_PERFORMANCE_BUDGET_FAILED");
