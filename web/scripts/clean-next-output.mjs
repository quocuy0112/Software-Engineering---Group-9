import { rm } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const target = resolve(workspace, ".next");

if (dirname(target) !== workspace || basename(target) !== ".next") {
  throw new Error("Refusing to clean an unexpected Next.js output path");
}

await rm(target, { recursive: true, force: true });
