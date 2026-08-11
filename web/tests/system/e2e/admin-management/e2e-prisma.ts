import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

export async function queryAdminE2eState<T>(
  query: "account" | "verification" | "membership",
  id: string,
): Promise<T> {
  const script = resolve(
    process.cwd(),
    "tests/system/e2e/admin-management/e2e-prisma-query.mjs",
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", script, query, id],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as T;
}
