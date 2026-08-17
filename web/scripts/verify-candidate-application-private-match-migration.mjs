import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ pass: true, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const tableNames = [
    "PrivateCvMatchCheck",
    "PrivateCvMatchAttempt",
    "PrivateAutomaticMatchResult",
    "PrivateAiEvaluationResult",
    "PrivateMatchEvidence",
    "PrivateCvMatchCommandReceipt",
  ];
  const tables = await client.query(`
    SELECT "tablename" FROM pg_tables
    WHERE schemaname = 'public' AND "tablename" = ANY($1::text[])
  `, [tableNames]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  const missingTables = tableNames.filter((name) => !found.has(name));
  const currentPointers = await client.query(`
    SELECT check_row."id"
      FROM "PrivateCvMatchCheck" check_row
      LEFT JOIN "PrivateCvMatchAttempt" attempt
        ON attempt."id" = check_row."currentAttemptId"
     WHERE check_row."currentAttemptId" IS NOT NULL
       AND (attempt."id" IS NULL OR attempt."checkId" <> check_row."id")
  `);
  const invalidPublication = await client.query(`
    SELECT check_row."id"
      FROM "PrivateCvMatchCheck" check_row
      JOIN "PrivateCvMatchAttempt" attempt
        ON attempt."id" = check_row."currentAttemptId"
     WHERE attempt."state" NOT IN ('READY', 'LIMITED')
  `);
  const invalidDeadlines = await client.query(`
    SELECT "id" FROM "PrivateCvMatchCheck"
     WHERE "expiresAt" <= "createdAt"
        OR ("inaccessibleAt" IS NOT NULL AND ("deleteAfter" IS NULL OR "deleteAfter" > "inaccessibleAt" + INTERVAL '30 days'))
  `);
  const foreignKeys = await client.query(`
    SELECT source.relname AS source_table,
           target.relname AS target_table
      FROM pg_constraint constraint_row
      JOIN pg_class source ON source.oid = constraint_row.conrelid
      JOIN pg_class target ON target.oid = constraint_row.confrelid
     WHERE constraint_row.contype = 'f'
       AND source.relname IN (${tableNames.map((_, index) => `$${index + 1}`).join(", ")})
  `, tableNames);
  const forbiddenForeignKeys = foreignKeys.rows.filter((row) => !tableNames.includes(row.target_table));
  const requiredIndexes = await client.query(`
    SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
         'PrivateCvMatchCheck_candidate_created_idx',
         'PrivateCvMatchCheck_expiry_idx',
         'PrivateCvMatchCheck_cleanup_idx',
         'PrivateCvMatchAttempt_work_idx'
       )
  `);
  const requiredIndexNames = [
    "PrivateCvMatchCheck_candidate_created_idx",
    "PrivateCvMatchCheck_expiry_idx",
    "PrivateCvMatchCheck_cleanup_idx",
    "PrivateCvMatchAttempt_work_idx",
  ];
  const foundIndexes = new Set(requiredIndexes.rows.map((row) => row.indexname));
  const result = {
    pass: !missingTables.length && !currentPointers.rowCount && !invalidPublication.rowCount && !invalidDeadlines.rowCount && !forbiddenForeignKeys.length && requiredIndexNames.every((name) => foundIndexes.has(name)),
    missingTables,
    invalidCurrentAttemptPointers: currentPointers.rows,
    invalidPublication: invalidPublication.rows,
    invalidDeadlines: invalidDeadlines.rows,
    forbiddenForeignKeys,
    missingIndexes: requiredIndexNames.filter((name) => !foundIndexes.has(name)),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await client.end();
}
