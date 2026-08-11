import { readFile } from "node:fs/promises";
import { test as base, expect } from "@playwright/test";
import {
  ADMIN_E2E_STATE_PATH,
  type AdminE2eAuthRecord,
  type AdminE2eEnvironment,
} from "./admin-e2e-global-setup";
import { totp } from "./admin-e2e-totp";

type WorkerFixtures = {
  adminAuth: AdminE2eAuthRecord;
  adminStorageState: Awaited<
    ReturnType<import("@playwright/test").BrowserContext["storageState"]>
  >;
};

type TestFixtures = {
  adminPage: import("@playwright/test").Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  adminAuth: [
    // Playwright requires an object binding pattern even when a worker fixture
    // has no upstream fixture dependency.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide, workerInfo) => {
      const environment = JSON.parse(
        await readFile(ADMIN_E2E_STATE_PATH, "utf8"),
      ) as AdminE2eEnvironment;
      const auth = environment.administrators[workerInfo.project.name];
      if (!auth) throw new Error("ADMIN_E2E_AUTH_PROJECT_MISSING");
      await provide(auth);
    },
    { scope: "worker" },
  ],
  adminStorageState: [
    async ({ browser, adminAuth }, provide) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const origin =
        process.env.ADMIN_E2E_ORIGIN ?? "http://console.admin.localhost:3001";
      await page.goto(origin);
      await page.getByLabel("Email").fill(adminAuth.email);
      await page.getByLabel("Password").fill(adminAuth.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(
        page.getByRole("heading", { name: "Two-factor verification" }),
      ).toBeVisible();
      const loginTotpCode = totp(adminAuth.totpSecret);
      adminAuth.lastLoginTotpCode = loginTotpCode;
      await page.getByLabel("Six-digit authenticator code").fill(loginTotpCode);
      await page
        .getByRole("button", { name: "Verify and designate this session" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Platform administration" }),
      ).toBeVisible({ timeout: 20_000 });
      await provide(await context.storageState());
      await context.close();
    },
    { scope: "worker" },
  ],
  adminPage: async ({ browser, adminStorageState }, provide) => {
    const context = await browser.newContext({
      storageState: adminStorageState,
    });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect };
