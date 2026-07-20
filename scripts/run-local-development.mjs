import { spawn } from "node:child_process";
import process from "node:process";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is required");
const children = [
  spawn(process.execPath, [npmCli, "run", "dev:web", "--workspace", "@smarthire/web"], { stdio: "inherit" }),
  spawn(process.execPath, [npmCli, "run", "email:worker", "--workspace", "@smarthire/web"], { stdio: "inherit" }),
];
let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return; stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
for (const child of children) child.once("exit", (code) => {
  if (!stopping) { process.exitCode = code ?? 1; stop(); }
});
