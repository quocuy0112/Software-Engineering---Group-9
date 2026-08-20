import nextEnv from "@next/env";

// Keep standalone worker runs on the same environment contract as the Next
// server. dotenv/config only loads .env and silently misses local .env.local.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      {
        worker: "private-cv-match",
        ready: false,
        skipped: true,
        reason: "DATABASE_URL_NOT_CONFIGURED",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (process.argv.includes("--probe")) {
  console.log(
    JSON.stringify(
      { worker: "private-cv-match", ready: true, mode: "lease-aware" },
      null,
      2,
    ),
  );
  process.exit(0);
}

const { processPrivateMatchWorkOnce } =
  await import("../src/backend/private-cv-match/private-match-worker.ts");
const { PrivateMatchRetentionService } =
  await import("../src/backend/private-cv-match/private-match-retention.ts");

const watch = process.argv.includes("--watch");
let processed = 0;
let stopping = false;
let lastRetentionAt = 0;

const stop = () => {
  stopping = true;
};

if (watch) {
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (process.platform === "win32") process.once("SIGBREAK", stop);
}

while (!stopping) {
  const result = await processPrivateMatchWorkOnce();
  if (result !== "IDLE") {
    processed += 1;
  } else if (!watch) {
    break;
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  if (watch && Date.now() - lastRetentionAt >= 60_000) {
    const retention = new PrivateMatchRetentionService();
    await retention.expire();
    await retention.cleanup(`private-match-retention-${process.pid}`);
    lastRetentionAt = Date.now();
  }
}

const retention = new PrivateMatchRetentionService();
const expired = await retention.expire();
const cleanup = await retention.cleanup(
  `private-match-retention-${process.pid}`,
);
console.log(
  JSON.stringify(
    {
      worker: "private-cv-match",
      ready: true,
      mode: watch ? "lease-aware-watch" : "lease-aware",
      processed,
      expired,
      cleanup,
      logs: "checkId/state/failureCode only",
    },
    null,
    2,
  ),
);
