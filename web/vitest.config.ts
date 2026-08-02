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
}

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
    // Integration files share one local PostgreSQL service. Bounding file-level
    // concurrency also keeps timing-sensitive UI effects from being starved.
    maxWorkers: 2,
    testTimeout: 15_000,
  },
});
