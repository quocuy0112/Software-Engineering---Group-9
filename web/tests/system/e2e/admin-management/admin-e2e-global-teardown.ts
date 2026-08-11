import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { adminE2eControl } from "./admin-e2e-process";
import {
  ADMIN_E2E_STATE_PATH,
  type AdminE2eEnvironment,
} from "./admin-e2e-global-setup";

export default async function globalTeardown() {
  const environment = JSON.parse(
    await readFile(ADMIN_E2E_STATE_PATH, "utf8"),
  ) as AdminE2eEnvironment;
  await adminE2eControl("cleanup-run", environment.runId);
  await rm(resolve(process.cwd(), ".local/admin-e2e"), {
    recursive: true,
    force: true,
  });
}
