import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { startAdminWorker } =
  await import("../src/backend/admin/workers/admin-worker-entry.ts");
const probe = process.argv.includes("--probe");
const worker = await startAdminWorker({ probe });
if (!probe) {
  const shutdown = async () => {
    await worker.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
