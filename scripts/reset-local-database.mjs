import { spawnSync } from "node:child_process";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docker = process.platform === "win32" ? "docker.exe" : "docker";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}.`,
    );
  }
}

function runNpm(args) {
  if (!process.env.npm_execpath) {
    throw new Error(
      "npm_execpath is unavailable. Run this reset through `npm run db:reset`.",
    );
  }

  run(process.execPath, [process.env.npm_execpath, ...args]);
}

console.log("Resetting the local SmartHire PostgreSQL volume...");
run(docker, ["compose", "down", "-v"]);
run(docker, ["compose", "up", "-d", "--wait", "postgres"]);

console.log("Applying available migrations...");
runNpm(["run", "db:deploy"]);

console.log("Importing the split local company and job fixtures...");
runNpm(["run", "db:seed:jobs"]);

console.log("Local database reset completed with demo job data.");
