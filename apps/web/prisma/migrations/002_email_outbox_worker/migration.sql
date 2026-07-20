CREATE INDEX IF NOT EXISTS "EmailOutbox_due_claim_idx"
ON "EmailOutbox" ("nextAttemptAt", "createdAt")
WHERE "status" IN ('PENDING', 'RETRYABLE');

CREATE UNIQUE INDEX IF NOT EXISTS "AuditEvent_email_terminal_unique"
ON "AuditEvent" ("action", "targetId")
WHERE "action" = 'email.delivery_failed' AND "targetId" IS NOT NULL;
