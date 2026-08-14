import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { rm } from "node:fs/promises";
import { acquireNextOutputLock } from "./next-output-lock.mjs";

const workspace = resolve(import.meta.dirname, "..");
const target = resolve(workspace, ".next");

if (dirname(target) !== workspace || basename(target) !== ".next") {
  throw new Error("Refusing to build with an unexpected Next.js output path");
}

const releaseNextOutputLock = await acquireNextOutputLock("next-build");

try {
  await rm(target, { recursive: true, force: true });
  const require = createRequire(import.meta.url);
  const nextCli = require.resolve("next/dist/bin/next");
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    const child = spawn(process.execPath, [nextCli, "build"], {
      cwd: workspace,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => {
      if (signal) rejectExit(new Error(`Next.js build stopped by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });

  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await releaseNextOutputLock();
}
