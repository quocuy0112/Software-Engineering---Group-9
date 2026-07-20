import "server-only";
import { config } from "dotenv";
config({ path: ".env.local", override: false, quiet: true });
void import("./email-worker-runtime").catch((error: unknown) => {
  const code = error instanceof Error && "code" in error ? String(error.code) : "WORKER_START_FAILED";
  console.error(`[email-worker] startup failed: ${code}`);
  process.exitCode = 1;
});
