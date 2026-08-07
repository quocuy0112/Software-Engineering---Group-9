import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.local", quiet: true });

// The interactive local app may opt in to the external parser, but the normal
// automated suite must stay deterministic and network-free. The dedicated
// synthetic live compatibility test is the only opt-in exception.
if (process.env.CV_OPENAI_LIVE_SYNTHETIC !== "1") {
  process.env.CV_PARSER_ADAPTER = "deterministic";
  process.env.CV_OPENAI_ENABLED = "false";
  process.env.CV_OPENAI_LOCAL_DEV_ENABLED = "false";
  process.env.OPENAI_API_KEY = "";
  // The normal suite injects interpreters and must never start a credentialed
  // image-search worker. Runtime/local validation still requires the shared
  // API key whenever the real worker is enabled.
  process.env.IMAGE_SEARCH_WORKER_ENABLED = "false";
}
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
