import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const marker = pathToFileURL(resolve("scripts/server-only-marker.mjs")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: marker, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const clean = (value) =>
  String(value ?? "")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[REDACTED_DB_URL]")
    .replace(/[A-Za-z0-9_-]{40,}/gu, "[REDACTED_SECRET]");

try {
  await import("../src/backend/email/workers/email-worker-runtime.ts");
} catch (error) {
  console.error(
    JSON.stringify(
      {
        name: clean(error?.name),
        code: clean(error?.code),
        message: clean(error?.message),
        causeName: clean(error?.cause?.name),
        causeCode: clean(error?.cause?.code),
        causeMessage: clean(error?.cause?.message),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
