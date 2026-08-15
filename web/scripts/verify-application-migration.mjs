import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(JSON.stringify({ pass: true, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const duplicateRows = await client.query(`
    SELECT "candidateUserId", "jobPostingId", COUNT(*)::int AS count
    FROM "JobApplication"
    GROUP BY "candidateUserId", "jobPostingId"
    HAVING COUNT(*) > 1
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
      duplicateRows.rowCount === 0 &&
      invalidStageRows.rowCount === 0 &&
      invalidDocumentRows.rowCount === 0,
    duplicateCandidateJobRows: duplicateRows.rows,
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
