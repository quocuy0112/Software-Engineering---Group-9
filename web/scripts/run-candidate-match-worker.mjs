import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({
    worker: "private-cv-match",
    ready: false,
    skipped: true,
    reason: "DATABASE_URL_NOT_CONFIGURED",
  }, null, 2));
  process.exit(0);
}

const { processPrivateMatchWorkOnce } = await import("../src/backend/private-cv-match/private-match-worker.ts");
const { PrivateMatchRetentionService } = await import("../src/backend/private-cv-match/private-match-retention.ts");

if (process.argv.includes("--probe")) {
  console.log(JSON.stringify({ worker: "private-cv-match", ready: true, mode: "lease-aware" }, null, 2));
  process.exit(0);
}

let processed = 0;
while (true) {
  const result = await processPrivateMatchWorkOnce();
  if (result === "IDLE") break;
  processed += 1;
}
const retention = new PrivateMatchRetentionService();
const expired = await retention.expire();
const cleanup = await retention.cleanup(`private-match-retention-${process.pid}`);
console.log(JSON.stringify({
  worker: "private-cv-match",
  ready: true,
  mode: "lease-aware",
  processed,
  expired,
  cleanup,
  logs: "checkId/state/failureCode only",
}, null, 2));

