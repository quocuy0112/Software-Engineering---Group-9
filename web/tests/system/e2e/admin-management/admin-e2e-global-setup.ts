import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FullConfig } from "@playwright/test";
import { adminE2eControl } from "./admin-e2e-process";

export type AdminE2eAuthRecord = {
  runId: string;
  userId: string;
  grantId: string;
  email: string;
  password: string;
  totpSecret: string;
  lastLoginTotpCode?: string;
};

export type AdminE2eEnvironment = {
  runId: string;
  administrators: Record<string, AdminE2eAuthRecord>;
};

export const ADMIN_E2E_STATE_PATH = resolve(
  process.cwd(),
  ".local/admin-e2e/environment.json",
);

export default async function globalSetup(config: FullConfig) {
  const projectNames = config.projects.map((project) => project.name);
  const environment = await adminE2eControl<AdminE2eEnvironment>(
    "setup-auth",
    ...projectNames,
  );
  await mkdir(resolve(process.cwd(), ".local/admin-e2e"), { recursive: true });
  await writeFile(ADMIN_E2E_STATE_PATH, JSON.stringify(environment), "utf8");
  process.env.ADMIN_E2E_READY = "1";
}
