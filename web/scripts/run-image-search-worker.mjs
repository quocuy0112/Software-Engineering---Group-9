import { constants } from "node:fs";
import { access, lstat } from "node:fs/promises";
import { createConnection } from "node:net";
import { isAbsolute } from "node:path";

import { checkCvScanner } from "./check-cv-scanner.mjs";
import { checkOcrEngine } from "./check-ocr-engine.mjs";

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
  const storageRoot = process.env.IMAGE_SEARCH_STORAGE_LOCAL_ROOT ?? "";
  if (!isAbsolute(storageRoot)) {
    throw new Error("Image-search storage root must be an absolute path.");
  }
  const metadata = await lstat(storageRoot);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("Image-search storage root must be a real directory.");
  }
  await access(storageRoot, constants.R_OK | constants.W_OK);

  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== "postgres" || databaseUrl.port !== "5432") {
    throw new Error("Image-search worker must use container PostgreSQL.");
  }
  await probeTcp(databaseUrl.hostname, Number(databaseUrl.port));
  await checkCvScanner();
  if (process.env.OCR_ENGINE_ENABLED === "true") await checkOcrEngine();
  console.log(
    "Image-search worker probe passed for PostgreSQL, private storage, scanner, and OCR boundaries.",
  );
}

if (process.argv.includes("--probe")) {
  await runProbe();
} else {
  const workerModule =
    await import("../src/backend/image-search/workers/entry.ts");
  if (typeof workerModule.runImageSearchWorker !== "function") {
    throw new Error(
      "Image-search worker entry module must export runImageSearchWorker().",
    );
  }
  await workerModule.runImageSearchWorker();
}
