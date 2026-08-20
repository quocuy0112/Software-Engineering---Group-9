const { runCandidateExportRetention } = await import(
  "../src/backend/exports/candidate-export-retention.ts"
);
const { ActivityRetentionService } = await import(
  "../src/backend/analytics/activity-retention-service.ts"
);
const now = new Date();
console.log(
  JSON.stringify(
    {
      exports: await runCandidateExportRetention(now),
      activity: await new ActivityRetentionService().run(now),
    },
    null,
    2,
  ),
);
