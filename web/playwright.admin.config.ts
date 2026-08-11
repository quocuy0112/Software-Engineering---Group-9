import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Keep the pinned browser runtime inside the workspace. This makes the E2E
// environment reproducible in CI and in restricted developer sandboxes where
// executables installed under the user profile cannot be launched.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  process.cwd(),
  ".local/playwright-browsers",
);
process.env.ADMIN_E2E_READY = "1";

export default defineConfig({
  testDir: "./tests/system/e2e/admin-management",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/system/e2e/admin-management/admin-e2e-global-setup.ts",
  globalTeardown:
    "./tests/system/e2e/admin-management/admin-e2e-global-teardown.ts",
  webServer: {
    // Launch Next directly so Playwright owns the actual server process. On
    // Windows an npm wrapper can exit while leaving its child alive, which
    // makes failed E2E runs hang during teardown.
    command: "node tests/system/e2e/admin-management/admin-e2e-web-server.mjs",
    url: "http://localhost:3001",
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      EMAIL_ADAPTER: "capture",
      ADMIN_EVIDENCE_STORAGE_ROOT: resolve(
        process.cwd(),
        ".local/admin-e2e/evidence",
      ),
    },
    timeout: 180_000,
  },
  use: { baseURL: "http://localhost:3001", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-320",
      use: { browserName: "chromium", viewport: { width: 320, height: 720 } },
    },
  ],
});
