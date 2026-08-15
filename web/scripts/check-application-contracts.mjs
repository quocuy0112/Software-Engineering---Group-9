import { readFile } from "node:fs/promises";

const openapi = await readFile(
  new URL("../../spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/contracts/openapi.yaml", import.meta.url),
  "utf8",
);
const shared = await readFile(new URL("../src/shared/contracts/applications/index.ts", import.meta.url), "utf8");
const requiredMarkers = [
  "/api/recruiter/jobs/{jobId}/applications",
  "ApplicationPage",
  "SubmittedCandidate",
  "applicationPageSchema",
  "applicationSafeErrorSchema",
];
const missing = requiredMarkers.filter((marker) => !openapi.includes(marker) && !shared.includes(marker));
if (missing.length) throw new Error(`Application contract markers are missing: ${missing.join(", ")}`);
console.log(JSON.stringify({ pass: true, checked: requiredMarkers }, null, 2));
