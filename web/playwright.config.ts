import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";
const appOnlyServer = process.env.PLAYWRIGHT_APP_ONLY === "1";
const productionServer = process.env.PLAYWRIGHT_PRODUCTION === "1";
const nextOnlyServer = process.env.PLAYWRIGHT_NEXT_ONLY === "1";

export default defineConfig({
  testDir: "./tests/system/e2e",
  // Stateful identity flows share the local PostgreSQL and capture worker;
  // serialize them to keep browser evidence deterministic.
  workers: 1,
  webServer: {
    command: nextOnlyServer
      ? "next start --port 3001"
      : appOnlyServer
      ? productionServer
        ? "npm run start"
        : "npm run dev"
      : "node ../scripts/run-local-development.mjs",
    url: "http://localhost:3001",
    reuseExistingServer,
    env: { EMAIL_ADAPTER: "capture" },
  },
  use: { baseURL: "http://localhost:3001" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-320",
      use: { browserName: "chromium", viewport: { width: 320, height: 720 } },
    },
  ],
});
