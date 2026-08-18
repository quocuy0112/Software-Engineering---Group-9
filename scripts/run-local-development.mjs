import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const shutdownTimeoutMs = 5_000;
const commandLineArgs = new Set(process.argv.slice(2));
// Playwright invokes this supervisor from web/, while root scripts invoke it
// from the repository root. Resolve from the script location so both modes
// launch the same workspace.
const workspace = resolve(dirname(import.meta.filename), "..");
const webRoot = join(workspace, "web");

const children = new Map();
let shutdownPromise;

function runCommand(name, executable, args) {
  console.log(`[dev] ${name}`);
  const child = spawn(executable, args, {
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  children.set(name, child);

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      children.delete(name);
      resolve(result);
    };

    child.once("error", (error) => {
      console.error(
        `[dev] ${name} failed to start: ${error.code ?? "PROCESS_START_FAILED"}`,
      );
      finish({ ok: false, exitCode: 1 });
    });
    child.once("exit", (code, signal) => {
      const exitCode = typeof code === "number" ? code : 1;
      finish({ ok: exitCode === 0, exitCode, signal });
    });
  });
}

function hasFlag(...flags) {
  return flags.some((flag) => commandLineArgs.has(flag));
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

function getDockerImageCreatedAt(image) {
  const result = spawnSync(
    "docker",
    ["image", "inspect", "--format", "{{.Created}}", image],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 5_000,
    },
  );
  if (result.status !== 0) return null;

  const createdAt = Date.parse(result.stdout.trim());
  return Number.isFinite(createdAt) ? createdAt : null;
}

const ignoredBuildInputNames = new Set([
  ".git",
  ".next",
  ".local",
  ".pytest_cache",
  ".ruff_cache",
  "coverage",
  "dist",
  "build",
  "__pycache__",
  "node_modules",
]);

function latestModifiedAt(pathname) {
  if (!existsSync(pathname)) return 0;

  const stat = lstatSync(pathname);
  if (!stat.isDirectory()) return stat.mtimeMs;

  let latest = stat.mtimeMs;
  for (const entry of readdirSync(pathname, { withFileTypes: true })) {
    if (
      ignoredBuildInputNames.has(entry.name) ||
      entry.name.startsWith(".env") ||
      entry.isSymbolicLink()
    ) {
      continue;
    }
    latest = Math.max(latest, latestModifiedAt(join(pathname, entry.name)));
  }
  return latest;
}

const workerBuildInputs = {
  "ocr-engine": ["Dockerfile.ocr-engine", "ocr-engine"],
  "cv-worker": [
    "web/Dockerfile.cv-worker",
    "package.json",
    "package-lock.json",
    "web/package.json",
    "web/tsconfig.json",
    "web/prisma.config.ts",
    "web/prisma",
    "web/scripts",
    "web/src",
  ],
  "image-search-worker": [
    "Dockerfile.image-search-worker",
    "package.json",
    "package-lock.json",
    "web/package.json",
    "web/tsconfig.json",
    "web/prisma.config.ts",
    "web/prisma",
    "web/scripts",
    "web/src",
  ],
  "admin-worker": [
    "Dockerfile.admin-worker",
    "package.json",
    "package-lock.json",
    "web",
  ],
};

function workerImageNeedsBuild(service) {
  const createdAt = getDockerImageCreatedAt(`smarthire-${service}:local`);
  if (createdAt === null) return true;

  const latestInputChange = Math.max(
    ...workerBuildInputs[service].map((pathname) =>
      latestModifiedAt(join(process.cwd(), pathname)),
    ),
  );
  return latestInputChange > createdAt + 1_000;
}

function startProcess(name, executable, args, fatal = true, options = {}) {
  const child = spawn(executable, args, {
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
    ...options,
  });
  children.set(name, child);
  child.once("error", (error) => {
    console.error(
      `[dev] ${name} failed to start: ${error.code ?? "PROCESS_START_FAILED"}`,
    );
    if (fatal) void shutdown(1, `${name} failed to start`);
    else
      console.error(
        `[dev] ${name} is unavailable; native CV import and ordinary search remain active`,
      );
  });
  child.once("exit", (code, signal) => {
    if (!shutdownPromise) {
      if (
        signal === "SIGINT" ||
        signal === "SIGTERM" ||
        signal === "SIGBREAK"
      ) {
        void shutdown(0, `${name} ${signal}`);
        return;
      }
      if (!fatal) {
        console.error(
          `[dev] ${name} stopped (${signal ?? `code ${code ?? "unknown"}`}); continuing with reduced OCR/image-search capability`,
        );
        return;
      }
      const exitCode = typeof code === "number" && code !== 0 ? code : 1;
      console.error(
        `[dev] ${name} exited unexpectedly (${signal ?? `code ${code ?? "unknown"}`})`,
      );
      void shutdown(exitCode, `${name} exited`);
    }
  });
  return child;
}

function start(name, command) {
  const commandArgs = {
    "dev:web": [
      "--import",
      "./scripts/register-server-runtime.mjs",
      "--import",
      "tsx",
      "server.ts",
    ],
    "email:worker": ["--import", "tsx", "scripts/run-email-worker.mjs"],
    "application-intake:worker": [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/run-application-intake-worker.mjs",
      "--watch",
    ],
  }[command];

  if (!commandArgs)
    throw new Error(`Unsupported local development command: ${command}`);

  return startProcess(name, process.execPath, commandArgs, true, {
    cwd: webRoot,
  });
}

function isRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function waitForExit(child) {
  if (!isRunning(child)) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}

function runTaskkill(pid, force) {
  return new Promise((resolve) => {
    const args = ["/PID", String(pid), "/T"];
    if (force) args.push("/F");
    const killer = spawn("taskkill.exe", args, {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("error", resolve);
    killer.once("exit", resolve);
  });
}

async function terminate(child, force = false) {
  if (!isRunning(child) || !child.pid) return;
  if (process.platform === "win32") {
    await runTaskkill(child.pid, force);
    return;
  }
  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function shutdownChildren(force = false) {
  const runningChildren = [...children.values()].filter(isRunning);
  if (runningChildren.length === 0) return;

  // Register exit listeners before sending the signal so a fast child cannot
  // exit between the termination request and waitForExit().
  const exited = runningChildren.map(waitForExit);
  await Promise.all(runningChildren.map((child) => terminate(child, force)));
  await Promise.all(exited);
}

async function shutdown(exitCode, reason) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`[dev] shutting down (${reason})`);
    let timeout;
    try {
      const graceful = shutdownChildren();
      const timedOut = new Promise((resolve) => {
        timeout = setTimeout(() => resolve(false), shutdownTimeoutMs);
      });

      if (!(await Promise.race([graceful, timedOut]))) {
        console.error(
          "[dev] graceful shutdown timed out; force-terminating remaining process trees",
        );
        await shutdownChildren(true);
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      // npm waits for this supervisor process. Explicitly exit only after all
      // tracked descendants have been asked to terminate.
      process.exit(exitCode);
    }
  })();
  return shutdownPromise;
}

const requestShutdown = (signal) => {
  void shutdown(0, signal).catch((error) => {
    console.error(
      "[dev] local development shutdown failed: " +
        (error instanceof Error ? error.message : "UNKNOWN_ERROR"),
    );
    process.exit(1);
  });
};

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));
if (process.platform === "win32") {
  process.once("SIGBREAK", () => requestShutdown("SIGBREAK"));
}

async function main() {
  const infrastructureServices = ["postgres", "clamav"];
  const builtServices = [
    "ocr-engine",
    "cv-worker",
    "image-search-worker",
    "admin-worker",
  ];
  const forceWorkerBuild =
    hasFlag("--build", "--build-workers") ||
    isTruthy(process.env.BUILD_WORKERS);
  const skipWorkerBuild =
    hasFlag("--skip-worker-build") || isTruthy(process.env.SKIP_WORKER_BUILD);

  let workerBuild = Promise.resolve({ ok: true, exitCode: 0 });
  if (skipWorkerBuild) {
    console.log(
      "[dev] skipping worker image build (--skip-worker-build / SKIP_WORKER_BUILD)",
    );
  } else {
    const changedServices = builtServices.filter(workerImageNeedsBuild);
    const servicesToBuild = forceWorkerBuild ? builtServices : changedServices;

    if (servicesToBuild.length === 0) {
      console.log(
        "[dev] worker images are up to date; skipping build (use --build-workers to force a rebuild)",
      );
    } else {
      const reason = forceWorkerBuild
        ? "requested worker image rebuild"
        : `missing or changed worker images: ${servicesToBuild.join(", ")}`;
      workerBuild = runCommand(`building worker images (${reason})`, "docker", [
        "compose",
        "build",
        ...servicesToBuild,
      ]);
    }
  }

  // Worker/OCR image builds can run npm ci and download large model layers.
  // Do not hold web startup behind that work. Built services start after the
  // optional background build completes.
  if (shutdownPromise) return;

  const composeUp = await runCommand(
    "starting or recovering Compose infrastructure: " +
      infrastructureServices.join(", "),
    "docker",
    ["compose", "up", "-d", "--no-build", ...infrastructureServices],
  );
  if (!composeUp.ok) {
    if (!shutdownPromise) {
      await shutdown(composeUp.exitCode, "Compose services failed to start");
    }
    return;
  }
  if (shutdownPromise) return;

  console.log(
    "[dev] Compose infrastructure and workers remain running after this dev session; use npm run infra:down to stop them explicitly",
  );
  console.log(
    "[dev] web startup does not wait for ClamAV health; scanner-dependent workers recover through Docker",
  );
  start("web", "dev:web");
  start("email worker", "email:worker");
  start("application intake worker", "application-intake:worker");

  void workerBuild.then(async (result) => {
    if (!result.ok) {
      if (!shutdownPromise) {
        console.error(
          `[dev] worker image build failed (code ${result.exitCode}); web development remains available`,
        );
      }
      return;
    }
    if (shutdownPromise) return;

    const workerStart = await runCommand(
      "starting restartable worker services: " + builtServices.join(", "),
      "docker",
      ["compose", "up", "-d", "--no-build", "--no-deps", ...builtServices],
    );
    if (!workerStart.ok && !shutdownPromise) {
      console.error(
        "[dev] worker services are recovering in Docker; web development remains available",
      );
    }
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error("[dev] local development supervisor failed: " + message);
  if (!shutdownPromise) void shutdown(1, "local supervisor failed");
});
