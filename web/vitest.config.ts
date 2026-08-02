import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.local", quiet: true });

// PostgreSQL timestamp columns are timezone-naive. Run tests in UTC so the
// controlled clocks used by lease, retry, and retention tests stay portable.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["tests/system/e2e/**", "node_modules/**"],
    // Integration files share one local PostgreSQL service and several cleanup
    // workers intentionally claim across uploads. Run files sequentially so
    // independent fixtures cannot deadlock or consume each other's due work.
    maxWorkers: 1,
    testTimeout: 15_000,
  },
});
