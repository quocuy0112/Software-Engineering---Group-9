import { spawn } from "node:child_process";
import process from "node:process";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`OCR_TEST_COMMAND_FAILED_${code}`)),
    );
  });
}

await run("docker", [
  "build",
  "--target",
  "test",
  "--file",
  "Dockerfile.ocr-engine",
  "--tag",
  "smarthire-ocr-engine:test",
  ".",
]);
await run("docker", [
  "run",
  "--rm",
  "--network",
  "none",
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges:true",
  "--tmpfs",
  "/tmp:rw,noexec,nosuid,size=256m,uid=10001,gid=102",
  "smarthire-ocr-engine:test",
]);
