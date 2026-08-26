import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      { pass: true, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" },
      null,
      2,
    ),
  );
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const tableNames = [
    "JobPostingViewFact",
    "JobPostingLifecycleFact",
    "ExportRequest",
    "ActivityLegalHold",
  ];
  const tables = await client.query(
    'SELECT "tablename" FROM pg_tables WHERE schemaname = \'public\' AND "tablename" = ANY($1::text[])',
    [tableNames],
  );
  const foundTables = new Set(tables.rows.map((row) => row.tablename));
  const indexNames = [
    "JobPostingViewFact_qualified_visitor_day_key",
    "JobPostingLifecycleFact_jobPostingId_postingVersion_key",
    "ExportRequest_claim_idx",
    "ExportRequest_cleanup_idx",
    "AuditEvent_analytics_retention_idx",
  ];
  const indexes = await client.query(
    'SELECT "indexname" FROM pg_indexes WHERE schemaname = \'public\' AND "indexname" = ANY($1::text[])',
    [indexNames],
  );
  const foundIndexes = new Set(indexes.rows.map((row) => row.indexname));
  const baseline = await client.query(
    'SELECT COUNT(*)::int AS "count" FROM "JobPostingLifecycleFact" WHERE "correlationId" LIKE \'analytics-baseline-v1:%\'',
  );
  const result = {
    pass:
      tableNames.every((name) => foundTables.has(name)) &&
      indexNames.every((name) => foundIndexes.has(name)),
    missingTables: tableNames.filter((name) => !foundTables.has(name)),
    missingIndexes: indexNames.filter((name) => !foundIndexes.has(name)),
    lifecycleBaselineCount: baseline.rows[0]?.count ?? 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await client.end();
}
