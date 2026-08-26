ALTER TABLE "JobPostReviewVersion"
DROP CONSTRAINT "JobPostReviewVersion_state_fields_check";

ALTER TABLE "JobPostReviewVersion"
ADD CONSTRAINT "JobPostReviewVersion_state_fields_check" CHECK (
  (
    "state" = 'PENDING_REVIEW'
    AND "decidedByAdminUserId" IS NULL
    AND "decidedAt" IS NULL
    AND "publishedAt" IS NULL
    AND "reasonCode" IS NULL
    AND "publicExplanation" IS NULL
  )
  OR
  (
    "state" = 'APPROVED'
    AND "decidedAt" IS NOT NULL
    AND "publishedAt" IS NOT NULL
    AND "reasonCode" IS NULL
    AND "publicExplanation" IS NULL
  )
  OR
  (
    "state" = 'REJECTED'
    AND "decidedByAdminUserId" IS NOT NULL
    AND "decidedAt" IS NOT NULL
    AND "publishedAt" IS NULL
    AND "reasonCode" IS NOT NULL
    AND length("publicExplanation") BETWEEN 20 AND 1000
  )
  OR
  (
    "state" = 'WITHDRAWN'
    AND "decidedByAdminUserId" IS NULL
    AND "decidedAt" IS NOT NULL
    AND "publishedAt" IS NULL
    AND "reasonCode" IS NULL
    AND "publicExplanation" IS NULL
  )
);
