import { randomUUID } from "node:crypto";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
await client.connect();
await client.query("BEGIN");
try {
  const missingOperationWork = await client.query(`
    INSERT INTO "ScoringWorkItem" (
      id, "operationId", "jobApplicationId", state, "nextAttemptAt", "createdAt", "updatedAt"
    )
    SELECT gen_random_uuid()::text, operation.id, operation."jobApplicationId", 'QUEUED', NOW(), NOW(), NOW()
      FROM "ScoringOperation" operation
     WHERE operation.state = 'QUEUED'
       AND operation."jobApplicationId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "ScoringWorkItem" work WHERE work."operationId" = operation.id AND work."jobApplicationId" = operation."jobApplicationId")
    ON CONFLICT ("operationId", "jobApplicationId") DO NOTHING
  `);
  await client.query(`
    UPDATE "JobApplication" application
       SET "scoringStatus" = 'FAILED', "aiMatchScore" = NULL, "updatedAt" = NOW()
      FROM "ApplicationScoringResult" result
     WHERE result.id = application."currentScoringResultId"
       AND result.state = 'DETERMINISTIC_ONLY'
       AND application."aiAnalysisConsent" = TRUE
       AND application."scoringStatus" IN ('PROCESSING', 'PENDING')
  `);
  const applications = await client.query(`
    SELECT application.id, application."candidateUserId", application."jobPostingId",
           job.version
      FROM "JobApplication" application
      JOIN "JobPosting" job ON job.id = application."jobPostingId"
     WHERE application."aiAnalysisConsent" = TRUE
       AND application."currentScoringResultId" IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM "ScoringWorkItem" work
          WHERE work."jobApplicationId" = application.id
            AND work.state IN ('QUEUED', 'LEASED', 'AUTOMATIC_READY', 'AI_PENDING')
       )
     FOR UPDATE OF application
  `);
  for (const application of applications.rows) {
    const operationId = randomUUID();
    const now = new Date();
    await client.query(
      `INSERT INTO "ScoringOperation" (
         id, kind, "jobPostingId", "jobApplicationId", "requestedByUserId",
         "requestedAt", "confirmationIntent", "idempotencyKey",
         "targetJobDescriptionVersionId", "targetScoringConfigVersionId",
         state, "totalCount", "createdAt", "updatedAt"
       ) VALUES ($1, 'INITIAL', $2, $3, $4, $5, TRUE, $6, $7,
                 'hybrid-60-40-v1', 'QUEUED', 1, $5, $5)`,
      [
        operationId,
        application.jobPostingId,
        application.id,
        application.candidateUserId,
        now,
        `initial-scoring:${application.id}`,
        `job-${application.jobPostingId}-v${application.version}`,
      ],
    );
    await client.query(
      `INSERT INTO "ScoringWorkItem" (
         id, "operationId", "jobApplicationId", state, "nextAttemptAt", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, 'QUEUED', $4, $4, $4)`,
      [randomUUID(), operationId, application.id, now],
    );
    await client.query(
      `UPDATE "JobApplication" SET "scoringStatus" = 'PROCESSING', "updatedAt" = $2 WHERE id = $1`,
      [application.id, now],
    );
  }
  const deterministic = await client.query(`
    SELECT application.id, application."jobPostingId", application."candidateUserId",
           automatic."jobDescriptionVersionId", automatic."scoringConfigVersionId", automatic.id AS "automaticResultId"
      FROM "JobApplication" application
      JOIN "ApplicationScoringResult" result ON result.id = application."currentScoringResultId"
      JOIN "AutomaticMatchResult" automatic ON automatic.id = result."automaticMatchResultId"
     WHERE result.state = 'DETERMINISTIC_ONLY'
       AND NOT EXISTS (
         SELECT 1 FROM "ScoringOperation" operation
          WHERE operation."jobApplicationId" = application.id
            AND operation."idempotencyKey" = 'system-recovery-ai-v3:' || application.id
       )
     FOR UPDATE OF application
  `);
  for (const application of deterministic.rows) {
    const operationId = randomUUID();
    const now = new Date();
    await client.query(
      `INSERT INTO "ScoringOperation" (id, kind, "jobPostingId", "jobApplicationId", "requestedByUserId", "requestedAt", "confirmationIntent", "idempotencyKey", "targetJobDescriptionVersionId", "targetScoringConfigVersionId", "reusedAutomaticMatchResultId", state, "totalCount", "createdAt", "updatedAt")
       VALUES ($1, 'AI_RETRY', $2, $3, $4, $5, TRUE, $6, $7, $8, $9, 'QUEUED', 1, $5, $5)`,
      [operationId, application.jobPostingId, application.id, application.candidateUserId, now, `system-recovery-ai-v3:${application.id}`, application.jobDescriptionVersionId, application.scoringConfigVersionId, application.automaticResultId],
    );
    await client.query(
      `INSERT INTO "ScoringWorkItem" (id, "operationId", "jobApplicationId", state, "nextAttemptAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'QUEUED', $4, $4, $4)`,
      [randomUUID(), operationId, application.id, now],
    );
    await client.query(`UPDATE "JobApplication" SET "scoringStatus" = 'PROCESSING', "updatedAt" = $2 WHERE id = $1`, [application.id, now]);
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ reconciled: applications.rowCount, recoveredQueuedWork: missingOperationWork.rowCount, queuedAiRecovery: deterministic.rowCount }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
