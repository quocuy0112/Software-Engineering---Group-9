import { registerHooks } from "node:module";

const emptyServerOnlyMarker = new URL("./server-only-marker.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: emptyServerOnlyMarker, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

await import("../src/server/email/workers/email-worker-entry.ts");
