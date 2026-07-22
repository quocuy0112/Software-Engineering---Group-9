import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Stateful identity flows share the local PostgreSQL and capture worker;
  // serialize them to keep browser evidence deterministic.
  workers: 1,
  webServer: { command: "node ../../scripts/run-local-development.mjs", url: "http://localhost:3000", reuseExistingServer: false, env: { EMAIL_ADAPTER: "capture" } },
  use: { baseURL: "http://localhost:3000" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-320", use: { browserName: "chromium", viewport: { width: 320, height: 720 } } },
  ],
});
