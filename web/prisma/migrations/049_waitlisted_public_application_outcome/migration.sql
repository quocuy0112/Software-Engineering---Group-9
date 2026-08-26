-- Add the canonical waitlisted outcome to the candidate-safe public update projection.
ALTER TYPE "ApplicationPublicOutcome" ADD VALUE IF NOT EXISTS 'WAITLISTED';
