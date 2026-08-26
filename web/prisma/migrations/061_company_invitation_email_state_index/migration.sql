-- DropIndex
DROP INDEX "JobPostReviewVersion_normalizedTitleSearch_idx";

-- CreateIndex
CREATE INDEX "CompanyInvitation_companyId_normalizedEmail_state_idx" ON "CompanyInvitation"("companyId", "normalizedEmail", "state");
