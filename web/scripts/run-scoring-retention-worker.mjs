import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ worker: "scoring-retention", ready: false, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

if (process.env.SCORING_RETENTION_RUNTIME !== "1") {
  const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", fileURLToPath(import.meta.url)], {
    env: { ...process.env, SCORING_RETENTION_RUNTIME: "1" },
    stdio: "inherit",
  });
  child.once("error", (error) => { throw error; });
  child.once("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
} else {
const { ScoringRetentionWorker } = await import("../src/backend/scoring/workers/scoring-retention.ts");
console.log(JSON.stringify(await new ScoringRetentionWorker().run(), null, 2));
}
