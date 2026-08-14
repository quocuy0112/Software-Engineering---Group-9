import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is required");
const database = new pg.Pool({ connectionString: databaseUrl });
const migration = await readFile(
  resolve("prisma/migrations/022_admin_user_management_refinement/migration.sql"),
  "utf8",
);
const destructive =
  migration.match(/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\b/gimu) ?? [];
try {
  if (destructive.length)
    throw new Error("Feature 009 migration contains a destructive statement");
  const [column, eventTable, indexes, rowCounts, legacy] = await Promise.all([
    database.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_name = 'RecruiterVerificationRequest' AND column_name = 'adminComment'`,
    ).then((result) => result.rows),
    database.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_name = 'VerificationNotificationEvent'`,
    ).then((result) => result.rows),
    database.query(
      `SELECT indexname FROM pg_indexes WHERE indexname IN ('user_state_createdAt_id_idx', 'user_normalizedEmail_trgm_idx') ORDER BY indexname`,
    ).then((result) => result.rows),
    database.query(
      `SELECT 'user' AS entity, COUNT(*)::int AS count FROM "user"
       UNION ALL SELECT 'candidate_identity', COUNT(*)::int FROM "CandidateIdentity"
       UNION ALL SELECT 'company', COUNT(*)::int FROM "Company"
       UNION ALL SELECT 'membership', COUNT(*)::int FROM "CompanyMembership"
       UNION ALL SELECT 'job_posting', COUNT(*)::int FROM "JobPosting"
       UNION ALL SELECT 'job_application', COUNT(*)::int FROM "JobApplication"
       UNION ALL SELECT 'verification', COUNT(*)::int FROM "RecruiterVerificationRequest"
       UNION ALL SELECT 'evidence', COUNT(*)::int FROM "BusinessLicenseEvidence"
       UNION ALL SELECT 'verification_history', COUNT(*)::int FROM "VerificationDecisionHistory"
       UNION ALL SELECT 'session', COUNT(*)::int FROM "session"
       UNION ALL SELECT 'audit', COUNT(*)::int FROM "AuditEvent"
       UNION ALL SELECT 'rationale', COUNT(*)::int FROM "PrivilegedActionRationale"
       UNION ALL SELECT 'security_notification', COUNT(*)::int FROM "SecurityNotificationWork"
       UNION ALL SELECT 'email_outbox', COUNT(*)::int FROM "EmailOutbox"
       UNION ALL SELECT 'verification_notification', COUNT(*)::int FROM "VerificationNotificationEvent"
       ORDER BY entity`,
    ).then((result) => result.rows),
    database.query(
      `SELECT COUNT(*)::int AS count FROM "RecruiterVerificationRequest" WHERE state = 'REJECTED' AND "adminComment" IS NULL`,
    ).then((result) => result.rows),
  ]);
  const result = {
    migration: "022_admin_user_management_refinement",
    additiveSql: destructive.length === 0,
    adminComment: Number(column[0]?.count ?? 0) === 1,
    notificationEventTable: Number(eventTable[0]?.count ?? 0) === 1,
    reviewedIndexes: indexes.map((row) => row.indexname),
    preservedEntityCounts: rowCounts,
    legacyRejectedWithoutReason: Number(legacy[0]?.count ?? 0),
    pass:
      destructive.length === 0 &&
      Number(column[0]?.count ?? 0) === 1 &&
      Number(eventTable[0]?.count ?? 0) === 1 &&
      indexes.length === 2,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await database.end();
}
