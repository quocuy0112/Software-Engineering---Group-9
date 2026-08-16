import { readFile } from "node:fs/promises";

const openapi = await readFile(new URL("../../spec-kit/specs/015-candidate-hybrid-ranking/contracts/openapi.yaml", import.meta.url), "utf8");
const shared = await readFile(new URL("../src/shared/contracts/scoring/schemas.ts", import.meta.url), "utf8");
const requiredMarkers = [
  "rankedApplicationPageSchema",
  "scoringDetailSchema",
  "ScoringOperation",
  "Not calculated",
  "Pending",
  "Unavailable",
  "Processing",
  "Sensitive personal attributes are excluded from scoring.",
  "finalScore",
  "ManualPriority",
];
const missing = requiredMarkers.filter((marker) => !shared.includes(marker) && !openapi.includes(marker));
if (missing.length) throw new Error("Scoring contract markers are missing: " + missing.join(", "));
console.log(JSON.stringify({ pass: true, checked: requiredMarkers }, null, 2));
