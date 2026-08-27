-- Keep removed taxonomy rows for existing jobs, approved snapshots, and audit
-- history while making the state distinct from a reversible deactivation.
ALTER TYPE "JobTaxonomyStatus" ADD VALUE IF NOT EXISTS 'REMOVED';
