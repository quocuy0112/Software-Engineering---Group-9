import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const group = process.argv.find((argument) => argument.startsWith("--group="));
const playwright = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../node_modules/@playwright/test/cli.js",
);
const child = spawn(
  process.execPath,
  [playwright, "test", "tests/system/e2e/admin-user-verification", "--pass-with-no-tests"],
  { stdio: "inherit", shell: false, env: { ...process.env, ADMIN_FEATURE_GROUP: group?.slice("--group=".length) ?? "all" } },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
