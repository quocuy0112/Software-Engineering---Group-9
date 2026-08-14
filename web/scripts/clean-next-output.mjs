import { rm } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { acquireNextOutputLock } from "./next-output-lock.mjs";

const workspace = resolve(import.meta.dirname, "..");
const target = resolve(workspace, ".next");

if (dirname(target) !== workspace || basename(target) !== ".next") {
  throw new Error("Refusing to clean an unexpected Next.js output path");
}

const releaseNextOutputLock = await acquireNextOutputLock("next-output-cleaner");

try {
  await rm(target, { recursive: true, force: true });
} finally {
  await releaseNextOutputLock();
}
