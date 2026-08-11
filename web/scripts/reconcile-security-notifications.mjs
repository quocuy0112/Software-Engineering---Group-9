import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is required");

const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: databaseUrl });
const cutoff = new Date(Date.now() - 24 * 60 * 60_000);

await client.connect();
try {
  await client.query("BEGIN");

  const linked = await client.query(`
    UPDATE "SecurityNotificationWork" work
       SET "emailOutboxId" = outbox."id",
           "updatedAt" = NOW()
      FROM "EmailOutbox" outbox
     WHERE work."emailOutboxId" IS NULL
       AND outbox."idempotencyKey" = 'security-work:' || work."id"
  `);

  const reconciled = await client.query(`
    UPDATE "SecurityNotificationWork" work
       SET "status" = CASE outbox."status"
           WHEN 'SENT' THEN 'DELIVERED'::"SecurityNotificationStatus"
           WHEN 'RETRYABLE' THEN 'RETRYING'::"SecurityNotificationStatus"
           WHEN 'DEAD' THEN 'MANUAL_INTERVENTION_REQUIRED'::"SecurityNotificationStatus"
           ELSE 'PENDING'::"SecurityNotificationStatus"
         END,
           "attemptCount" = outbox."attempts",
           "lastAttemptAt" = CASE
             WHEN outbox."attempts" > 0 THEN outbox."updatedAt"
             ELSE work."lastAttemptAt"
           END,
           "nextAttemptAt" = CASE
             WHEN outbox."status" IN ('PENDING', 'PROCESSING', 'RETRYABLE')
               THEN outbox."nextAttemptAt"
             ELSE NULL
           END,
           "failureCategory" = CASE
             WHEN outbox."status" = 'DEAD'
               THEN 'ATTEMPTS_EXHAUSTED'::"SecurityNotificationFailureCategory"
             WHEN outbox."status" IN ('PENDING', 'PROCESSING', 'RETRYABLE', 'SENT')
               THEN NULL
             ELSE work."failureCategory"
           END,
           "leaseOwner" = NULL,
           "leaseExpiresAt" = NULL,
           "updatedAt" = NOW()
      FROM "EmailOutbox" outbox
     WHERE work."emailOutboxId" = outbox."id"
       AND (
         work."status" IS DISTINCT FROM CASE outbox."status"
           WHEN 'SENT' THEN 'DELIVERED'::"SecurityNotificationStatus"
           WHEN 'RETRYABLE' THEN 'RETRYING'::"SecurityNotificationStatus"
           WHEN 'DEAD' THEN 'MANUAL_INTERVENTION_REQUIRED'::"SecurityNotificationStatus"
           ELSE 'PENDING'::"SecurityNotificationStatus"
         END
         OR work."attemptCount" IS DISTINCT FROM outbox."attempts"
       )
  `);

  const expired = await client.query(
    `UPDATE "SecurityNotificationWork"
        SET "status" = 'MANUAL_INTERVENTION_REQUIRED',
            "failureCategory" = COALESCE(
              "failureCategory",
              'ATTEMPTS_EXHAUSTED'::"SecurityNotificationFailureCategory"
            ),
            "nextAttemptAt" = NULL,
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL,
            "updatedAt" = NOW()
      WHERE "createdAt" < $1
        AND "status" <> 'DELIVERED'
        AND (
          "emailOutboxId" IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM "EmailOutbox" outbox
             WHERE outbox."id" = "SecurityNotificationWork"."emailOutboxId"
               AND outbox."status" = 'SENT'
          )
        )`,
    [cutoff],
  );

  const unresolved = await client.query(`
    SELECT work."id", work."status", work."createdAt",
           CASE
             WHEN work."emailOutboxId" IS NOT NULL THEN 'LINK_PRESENT'
             WHEN EXISTS (
               SELECT 1 FROM "EmailOutbox" outbox
                WHERE outbox."idempotencyKey" = 'security-work:' || work."id"
             ) THEN 'LEGACY_OUTBOX_ALREADY_LINKED_ELSEWHERE'
             ELSE 'NO_LEGACY_OUTBOX_MATCH'
           END AS reason
      FROM "SecurityNotificationWork" work
     WHERE work."emailOutboxId" IS NULL
     ORDER BY work."createdAt", work."id"
  `);

  if (apply) await client.query("COMMIT");
  else await client.query("ROLLBACK");

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "check",
        linked: linked.rowCount,
        reconciled: reconciled.rowCount,
        expired: expired.rowCount,
        unresolved: unresolved.rows,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
