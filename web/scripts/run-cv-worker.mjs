import { constants } from "node:fs";
import { access, lstat } from "node:fs/promises";
import { createConnection } from "node:net";
import { isAbsolute } from "node:path";
import nextEnv from "@next/env";

import { checkCvScanner } from "./check-cv-scanner.mjs";

const { loadEnvConfig } = nextEnv;

// Keep direct local-worker runs consistent with the custom web server. Docker
// injects its environment explicitly; loadEnvConfig leaves those values in
// place when no env files are present in the image.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const probeTcp = (host, port, timeoutMs = 5_000) =>
  new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("database connection probe timed out"));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

async function runProbe() {
  const storageRoot = process.env.CV_STORAGE_LOCAL_ROOT ?? "";
  if (!isAbsolute(storageRoot)) {
    throw new Error(
      "CV worker storage root must be an absolute container path.",
    );
  }
  const storageMetadata = await lstat(storageRoot);
  if (!storageMetadata.isDirectory() || storageMetadata.isSymbolicLink()) {
    throw new Error("CV worker storage root must be a real directory.");
  }
  await access(storageRoot, constants.R_OK | constants.W_OK);

  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== "postgres" || databaseUrl.port !== "5432") {
    throw new Error(
      "CV worker must use the container-native PostgreSQL endpoint.",
    );
  }
  await probeTcp(databaseUrl.hostname, Number(databaseUrl.port));
  await checkCvScanner();
  console.log(
    "CV worker probe passed for PostgreSQL, private storage, and Unix-socket scanner access.",
  );
}

if (process.argv.includes("--probe")) {
  await runProbe();
} else {
  const workerModule =
    await import("../src/backend/cv/workers/cv-worker-entry.ts");
  if (typeof workerModule.runCvWorker !== "function") {
    throw new Error("CV worker entry module must export runCvWorker().");
  }
  await workerModule.runCvWorker();
}
