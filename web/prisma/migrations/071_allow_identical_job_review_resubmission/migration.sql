-- A recruiter may legitimately withdraw and resubmit the same working copy.
-- Request-level duplicate protection remains enforced by the actor-scoped
-- idempotency key and each review still has a unique aggregate sequence.
DROP INDEX IF EXISTS "JobPostReviewVersion_reviewAggregateId_snapshotSha256_key";
