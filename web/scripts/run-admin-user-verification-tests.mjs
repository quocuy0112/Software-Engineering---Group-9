import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requestedGroup = process.argv
  .find((argument) => argument.startsWith("--group="))
  ?.slice("--group=".length);
const groups = {
  "1": [
    "tests/backend/unit/admin-user-verification/contract-projections.test.ts",
    "tests/backend/unit/admin-user-verification/group1-directory-boundaries.test.ts",
    "tests/architecture/admin-user-verification-boundaries.test.ts",
  ],
  "2": [
    "tests/backend/unit/admin-user-verification/contract-projections.test.ts",
    "tests/backend/unit/admin-user-verification/group2-verification-boundaries.test.ts",
    "tests/architecture/admin-user-verification-boundaries.test.ts",
  ],
  "3": [
    "tests/backend/unit/admin-user-verification/contract-projections.test.ts",
    "tests/backend/unit/admin-user-verification/group3-moderation-boundaries.test.ts",
    "tests/architecture/admin-user-verification-boundaries.test.ts",
  ],
};
const paths = requestedGroup && groups[requestedGroup]
  ? groups[requestedGroup]
  : [
      "tests/backend/unit/admin-user-verification",
      "tests/backend/contract/admin-user-verification",
      "tests/backend/integration/admin-user-verification",
      "tests/frontend/components/admin-user-verification",
      "tests/frontend/accessibility/admin-user-verification",
      "tests/architecture/admin-user-verification-boundaries.test.ts",
      "tests/security/admin-user-verification",
      "tests/performance/admin-user-verification",
      "tests/usability/admin-user-verification",
    ];

const executable = process.execPath;
const vitest = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../node_modules/vitest/vitest.mjs",
);
const child = spawn(
  executable,
  [vitest, "run", ...paths, "--passWithNoTests", "--reporter=dot"],
  { stdio: "inherit", shell: false },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
