import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

export async function adminE2eControl<T>(
  command: string,
  ...arguments_: string[]
): Promise<T> {
  const script = resolve(
    process.cwd(),
    "tests/system/e2e/admin-management/admin-e2e-control.mjs",
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", script, command, ...arguments_],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADMIN_EVIDENCE_STORAGE_ROOT:
          process.env.ADMIN_EVIDENCE_STORAGE_ROOT ??
          resolve(process.cwd(), ".local/admin-e2e/evidence"),
      },
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as T;
}
