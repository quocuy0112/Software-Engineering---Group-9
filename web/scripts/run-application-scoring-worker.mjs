import "dotenv/config";
import { applyAutomaticViewedStageRulesForAllApplications } from "../src/backend/applications/services/automatic-viewed-stage-rules.ts";
import { ScoringWorker } from "../src/backend/scoring/workers/scoring-worker.ts";
import { createScoringWorkProcessor } from "../src/backend/scoring/workers/scoring-work-processor.ts";

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      {
        worker: "application-scoring",
        ready: false,
        skipped: true,
        reason: "DATABASE_URL_NOT_CONFIGURED",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const worker = new ScoringWorker(undefined, createScoringWorkProcessor());
let processed = 0;
while (true) {
  const result = await worker.runOnce();
  if (result.state === "IDLE") break;
  processed += 1;
}
const automaticStageTransitions =
  await applyAutomaticViewedStageRulesForAllApplications();
console.log(
  JSON.stringify(
    {
      worker: "application-scoring",
      ready: true,
      mode: "lease-aware",
      processed,
      automaticStageTransitions: automaticStageTransitions.length,
      staleResultPolicy: "discard",
    },
    null,
    2,
  ),
);
