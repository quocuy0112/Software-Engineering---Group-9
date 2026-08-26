import nextEnv from "@next/env";

// The Next server loads .env.local, while dotenv/config only loads .env by
// default. Keep direct worker runs on the same environment contract as the
// web process so local intake work is not silently skipped.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ worker: "application-intake", ready: false, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

if (process.argv.includes("--probe")) {
  console.log(JSON.stringify({ worker: "application-intake", ready: true, mode: "lease-aware" }, null, 2));
  process.exit(0);
}

const { ApplicationIntakeService } = await import("../src/backend/candidate-applications/application-intake-service.ts");
const watch = process.argv.includes("--watch");
const service = new ApplicationIntakeService();
let processed = 0;
const workerId = `application-intake-${process.pid}`;

if (watch) {
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (process.platform === "win32") process.once("SIGBREAK", stop);

  while (!stopping) {
    const result = await service.processOne(workerId);
    if (result === null && !stopping) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } else if (result !== null) {
      processed += 1;
    }
  }
  console.log(JSON.stringify({ worker: "application-intake", ready: true, mode: "lease-aware", processed, stopped: true, monotonicProgress: true }, null, 2));
} else {
  while (true) {
    const result = await service.processOne(workerId);
    if (result === null) break;
    processed += 1;
  }
  console.log(JSON.stringify({ worker: "application-intake", ready: true, mode: "lease-aware", processed, monotonicProgress: true }, null, 2));
}
