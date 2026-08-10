import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "scripts/run-admin-worker.mjs", "--probe"],
  { cwd: new URL("..", import.meta.url), stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
