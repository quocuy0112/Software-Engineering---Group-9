const worker = await import("../src/backend/applications/workers/application-retention-worker.ts");
if (process.argv.includes("--probe")) {
  console.log(JSON.stringify(await worker.applicationRetentionProbe(), null, 2));
} else {
  console.log(JSON.stringify(await worker.runApplicationRetentionCycle(), null, 2));
}
