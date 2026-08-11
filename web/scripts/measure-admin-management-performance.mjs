import { performance } from "node:perf_hooks";

export function percentile(values, ratio) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[
    Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)
  ];
}

export function evaluate(samples, errors) {
  const durations = samples.map((sample) => sample.durationMs);
  const total = samples.length + errors;
  return {
    sampleCount: samples.length,
    errorCount: errors,
    errorRate: total ? errors / total : 1,
    p95Ms: percentile(durations, 0.95),
    usableWithinTwoSecondsRate: samples.length
      ? durations.filter((value) => value <= 2_000).length / samples.length
      : 0,
  };
}

async function measure() {
  if (process.argv.includes("--self-test")) {
    const result = evaluate(
      Array.from({ length: 100 }, (_, index) => ({
        durationMs: index < 96 ? 250 : 1_900,
      })),
      0,
    );
    if (result.usableWithinTwoSecondsRate < 0.95 || result.errorRate >= 0.01)
      process.exitCode = 1;
    console.log(JSON.stringify({ mode: "self-test", ...result }, null, 2));
    return;
  }

  const origin = process.env.ADMIN_PERF_ORIGIN;
  const cookie = process.env.ADMIN_PERF_AUTH_COOKIE;
  if (!origin || !cookie)
    throw new Error(
      "ADMIN_PERF_ORIGIN and ADMIN_PERF_AUTH_COOKIE are required",
    );
  const durationMs = Number(process.env.ADMIN_PERF_DURATION_MS ?? 15 * 60_000);
  const concurrency = Number(process.env.ADMIN_PERF_CONCURRENCY ?? 10);
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

  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      let index = worker;
      while (Date.now() < deadline) {
        const started = performance.now();
        try {
          const response = await fetch(
            new URL(paths[index % paths.length], origin),
            {
              headers: { cookie, accept: "application/json" },
              cache: "no-store",
            },
          );
          if (!response.ok) throw new Error(`HTTP_${response.status}`);
          await response.arrayBuffer();
          samples.push({
            path: paths[index % paths.length],
            durationMs: performance.now() - started,
          });
        } catch {
          errors += 1;
        }
        index += concurrency;
      }
    }),
  );

  const result = evaluate(samples, errors);
  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        durationMs,
        concurrency,
        requiredDataset: {
          accounts: 10_000,
          companies: 1_000,
          memberships: 5_000,
          openReviewItems: 1_000,
        },
        ...result,
      },
      null,
      2,
    ),
  );
  if (result.usableWithinTwoSecondsRate < 0.95 || result.errorRate >= 0.01)
    process.exitCode = 1;
}

await measure();
