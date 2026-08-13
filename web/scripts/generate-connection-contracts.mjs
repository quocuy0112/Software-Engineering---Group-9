import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const openapi = readFileSync(resolve(root, "../spec-kit/specs/011-professional-connection-proposals/contracts/openapi.yaml"), "utf8");
const generated = readFileSync(resolve(root, "src/shared/contracts/connections/generated.ts"), "utf8");
const paths = [...openapi.matchAll(/^  (\/api\/[^:]+):$/gmu)].map((match) => match[1]);
const missing = paths.filter((path) => !generated.includes(`"${path}"`));
const stale = [...generated.matchAll(/^    "(\/api\/[^"]+)",$/gmu)].map((match) => match[1]).filter((path) => !paths.includes(path));
if (missing.length || stale.length) {
  console.error(JSON.stringify({ missing, stale }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Professional connection contract manifest is current (${paths.length} paths).`);
}
