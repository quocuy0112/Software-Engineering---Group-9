import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ worker: "application-intake", ready: false, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

const { ApplicationIntakeService } = await import("../src/backend/candidate-applications/application-intake-service.ts");
if (process.argv.includes("--probe")) {
  console.log(JSON.stringify({ worker: "application-intake", ready: true, mode: "lease-aware" }, null, 2));
  process.exit(0);
}

const service = new ApplicationIntakeService();
let processed = 0;
while (true) {
  const result = await service.processOne(`application-intake-${process.pid}`);
  if (result === null) break;
  processed += 1;
}
console.log(JSON.stringify({ worker: "application-intake", ready: true, mode: "lease-aware", processed, monotonicProgress: true }, null, 2));
