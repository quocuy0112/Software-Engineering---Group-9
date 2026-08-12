import { spawn } from "node:child_process";
import process from "node:process";

const npmCli = process.env.npm_execpath;
const shutdownTimeoutMs = 5_000;

if (!npmCli) throw new Error("npm_execpath is required");

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

function startProcess(name, executable, args, fatal = true) {
  const child = spawn(executable, args, {
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
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
  return startProcess(name, process.execPath, [
    npmCli,
    "run",
    command,
    "--workspace",
    "@smarthire/web",
  ]);
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

async function shutdown(exitCode, reason) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`[dev] shutting down (${reason})`);
    await Promise.all([...children.values()].map((child) => terminate(child)));
    const exited = Promise.all([...children.values()].map(waitForExit)).then(
      () => true,
    );
    const timedOut = new Promise((resolve) =>
      setTimeout(() => resolve(false), shutdownTimeoutMs),
    );
    if (!(await Promise.race([exited, timedOut]))) {
      console.error(
        "[dev] graceful shutdown timed out; terminating remaining process trees",
      );
      await Promise.all(
        [...children.values()].map((child) => terminate(child, true)),
      );
      await Promise.all([...children.values()].map(waitForExit));
    }
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

process.once("SIGINT", () => void shutdown(0, "SIGINT"));
process.once("SIGTERM", () => void shutdown(0, "SIGTERM"));

async function main() {
  const infrastructureServices = ["postgres", "clamav", "ocr-engine"];
  const workerServices = ["cv-worker", "image-search-worker", "admin-worker"];
  const workerBuild = await runCommand("building worker images", "docker", [
    "compose",
    "build",
    "cv-worker",
    "ocr-engine",
    "image-search-worker",
    "admin-worker",
  ]);
  if (!workerBuild.ok) {
    if (!shutdownPromise) {
      await shutdown(workerBuild.exitCode, "worker image build failed");
    }
    return;
  }
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

  void runCommand(
    "starting restartable worker services: " + workerServices.join(", "),
    "docker",
    ["compose", "up", "-d", "--no-build", "--no-deps", ...workerServices],
  ).then((result) => {
    if (!result.ok && !shutdownPromise) {
      console.error(
        "[dev] worker services are recovering in Docker; web development remains available",
      );
    }
  });

  console.log(
    "[dev] Compose infrastructure and workers remain running after this dev session; use npm run infra:down to stop them explicitly",
  );
  console.log(
    "[dev] web startup does not wait for ClamAV health; scanner-dependent workers recover through Docker",
  );
  start("web", "dev:web");
  start("email worker", "email:worker");
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error("[dev] local development supervisor failed: " + message);
  if (!shutdownPromise) void shutdown(1, "local supervisor failed");
});
