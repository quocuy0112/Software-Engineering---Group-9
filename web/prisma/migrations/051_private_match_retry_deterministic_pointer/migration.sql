-- Multiple AI retry attempts may point at the same immutable deterministic result.
-- The attempt number remains unique per check, while the deterministic result is
-- shared by retries of the same private CV match check.
DROP INDEX IF EXISTS "PrivateCvMatchAttempt_deterministicResultId_key";
CREATE INDEX "PrivateCvMatchAttempt_deterministic_result_idx"
  ON "PrivateCvMatchAttempt" ("deterministicResultId");
