import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    JSON.stringify(
      { pass: true, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" },
      null,
      2,
    ),
  );
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const invalidAttemptNumberRows = await client.query(`
    SELECT "id", "applicationAttemptNumber"
    FROM "JobApplication"
    WHERE "applicationAttemptNumber" < 1
       OR "applicationAttemptNumber" > 5
    LIMIT 50
  `);
  const applicationAttemptInvariantRows = await client.query(`
    SELECT
      application."candidateUserId",
      application."jobPostingId",
      COUNT(*)::int AS history_count,
      MIN(application."applicationAttemptNumber")::int AS first_attempt,
      MAX(application."applicationAttemptNumber")::int AS last_attempt,
      counter."applicationCount" AS counter_count
    FROM "JobApplication" application
    LEFT JOIN "JobApplicationAttemptCounter" counter
      ON counter."candidateUserId" = application."candidateUserId"
     AND counter."jobPostingId" = application."jobPostingId"
    GROUP BY
      application."candidateUserId",
      application."jobPostingId",
      counter."applicationCount"
    HAVING COUNT(*) > 5
       OR counter."applicationCount" IS NULL
       OR counter."applicationCount" <> COUNT(*)
       OR MIN(application."applicationAttemptNumber") <> 1
       OR MAX(application."applicationAttemptNumber") <> COUNT(*)
    LIMIT 50
  `);
  const orphanCounterRows = await client.query(`
    SELECT
      counter."candidateUserId",
      counter."jobPostingId",
      counter."applicationCount"
    FROM "JobApplicationAttemptCounter" counter
    LEFT JOIN "JobApplication" application
      ON application."candidateUserId" = counter."candidateUserId"
     AND application."jobPostingId" = counter."jobPostingId"
    GROUP BY
      counter."candidateUserId",
      counter."jobPostingId",
      counter."applicationCount"
    HAVING COUNT(application."id") <> counter."applicationCount"
    LIMIT 50
  `);
  const invalidStageRows = await client.query(`
    SELECT "id"
    FROM "JobApplication"
    WHERE "stageVersion" < 1 OR "lastStageChangedAt" IS NULL
    LIMIT 50
  `);
  const invalidDocumentRows = await client.query(`
    SELECT document."id"
    FROM "ApplicationDocument" document
    WHERE document."byteLength" < 1
       OR document."byteLength" > 5000000
       OR document."committedAt" IS NULL
       OR document."storageKeyEncrypted" = ''
    LIMIT 50
  `);
  const stateCounts = await client.query(`
    SELECT "legacyDocumentState" AS state, COUNT(*)::int AS count
    FROM "JobApplication"
    GROUP BY "legacyDocumentState"
    ORDER BY "legacyDocumentState"
  `);
  const result = {
    pass:
      invalidAttemptNumberRows.rowCount === 0 &&
      applicationAttemptInvariantRows.rowCount === 0 &&
      orphanCounterRows.rowCount === 0 &&
      invalidStageRows.rowCount === 0 &&
      invalidDocumentRows.rowCount === 0,
    invalidAttemptNumberRows: invalidAttemptNumberRows.rows,
    applicationAttemptInvariantRows: applicationAttemptInvariantRows.rows,
    orphanCounterRows: orphanCounterRows.rows,
    invalidStageRows: invalidStageRows.rows,
    invalidDocumentRows: invalidDocumentRows.rows,
    legacyDocumentStateCounts: stateCounts.rows,
    contentFree: true,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await client.end();
}
