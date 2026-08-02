import { spawn } from "node:child_process";
import process from "node:process";

const npmCli = process.env.npm_execpath;
const shutdownTimeoutMs = 5_000;

if (!npmCli) throw new Error("npm_execpath is required");

const children = new Map();
let shutdownPromise;

function startProcess(name, executable, args) {
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
    void shutdown(1, `${name} failed to start`);
  });
  child.once("exit", (code, signal) => {
    if (!shutdownPromise) {
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
    const composeStop = spawn(
      "docker",
      ["compose", "stop", "cv-worker", "clamav"],
      { stdio: "inherit", windowsHide: true },
    );
    await waitForExit(composeStop);
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

startProcess("CV worker and scanner", "docker", [
  "compose",
  "up",
  "--build",
  "postgres",
  "clamav",
  "cv-worker",
]);
start("web", "dev:web");
start("email worker", "email:worker");
