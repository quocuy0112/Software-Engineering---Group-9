-- Current hybrid CV scoring policy: 40% automatic matching + 60% AI.
-- Historical rows may still carry the retired 60/40 weights, so the checks
-- accept both immutable policy versions while new rows default to 40/60.

ALTER TABLE "PrivateAutomaticMatchResult"
  ALTER COLUMN "weight" SET DEFAULT 0.40;

ALTER TABLE "PrivateAiEvaluationResult"
  ALTER COLUMN "weight" SET DEFAULT 0.60;

ALTER TABLE "PrivateAutomaticMatchResult"
  DROP CONSTRAINT IF EXISTS "PrivateAutomaticMatchResult_weight_check";

ALTER TABLE "PrivateAutomaticMatchResult"
  ADD CONSTRAINT "PrivateAutomaticMatchResult_weight_check"
  CHECK ("weight" IN (0.40, 0.60));

ALTER TABLE "PrivateAiEvaluationResult"
  DROP CONSTRAINT IF EXISTS "PrivateAiEvaluationResult_weight_check";

ALTER TABLE "PrivateAiEvaluationResult"
  ADD CONSTRAINT "PrivateAiEvaluationResult_weight_check"
  CHECK ("weight" IN (0.40, 0.60));
