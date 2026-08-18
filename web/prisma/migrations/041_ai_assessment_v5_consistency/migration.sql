-- Keep legacy STANDARD rows readable while adding explicit confidence tiers
-- for the shared AI-assessment contract.
ALTER TYPE "ScoringAiConfidenceLevel" ADD VALUE IF NOT EXISTS 'MEDIUM';
ALTER TYPE "ScoringAiConfidenceLevel" ADD VALUE IF NOT EXISTS 'HIGH';

ALTER TABLE "AiAssessment"
  ADD COLUMN IF NOT EXISTS "scoreReasoningJsonEncrypted" TEXT;
