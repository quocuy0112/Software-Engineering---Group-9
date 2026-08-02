-- Feature 003 is additive and forward-only. Back up non-disposable data before
-- deployment. Do not edit Feature 001/002 migrations. If verification fails,
-- correct data or indexes in a reviewed roll-forward migration; restore the
-- backup if affected production data cannot be repaired safely.
-- This migration intentionally contains no production seed rows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT','PENDING_REVIEW','ACTIVE','CLOSED','EXPIRED','REJECTED','REMOVED');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','TEMPORARY');
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY','JUNIOR','MID','SENIOR','LEAD','MANAGER');
CREATE TYPE "WorkArrangement" AS ENUM ('ONSITE','HYBRID','REMOTE');
CREATE TYPE "SalaryPeriod" AS ENUM ('HOUR','MONTH','YEAR');
CREATE TYPE "ApplicationQuestionKind" AS ENUM ('TEXT','BOOLEAN','SINGLE_CHOICE');
CREATE TYPE "JobReportReason" AS ENUM ('FRAUD','MISLEADING','DUPLICATE','DISCRIMINATORY','INAPPROPRIATE','OTHER');
CREATE TYPE "JobReportStatus" AS ENUM ('PENDING_REVIEW','RESOLVED','DISMISSED');
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED','VIEWED','SHORTLISTED','INTERVIEWING','OFFERED','HIRED','OFFER_DECLINED','REJECTED','WAITLISTED');
CREATE TYPE "RecruitmentNotificationAudience" AS ENUM ('CANDIDATE','COMPANY');
CREATE TYPE "RecruitmentNotificationKind" AS ENUM ('APPLICATION_SUBMITTED','APPLICATION_RECEIVED');

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "websiteUrl" TEXT,
  "publicDescription" TEXT,
  "publicLocation" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Company_name_lengths_check" CHECK (
    char_length("legalName") BETWEEN 1 AND 200 AND
    char_length("displayName") BETWEEN 1 AND 160 AND
    ("publicDescription" IS NULL OR char_length("publicDescription") <= 3000) AND
    ("publicLocation" IS NULL OR char_length("publicLocation") <= 160)
  ),
  CONSTRAINT "Company_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE TABLE "JobPosting" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "responsibilities" TEXT NOT NULL,
  "requirements" TEXT NOT NULL,
  "benefits" TEXT,
  "location" TEXT NOT NULL,
  "normalizedLocation" TEXT NOT NULL,
  "employmentType" "EmploymentType" NOT NULL,
  "experienceLevel" "ExperienceLevel" NOT NULL,
  "workArrangement" "WorkArrangement" NOT NULL,
  "salaryMin" DECIMAL(14,2),
  "salaryMax" DECIMAL(14,2),
  "salaryCurrency" VARCHAR(3),
  "salaryPeriod" "SalaryPeriod",
  "searchDocumentNormalized" TEXT NOT NULL,
  "status" "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "applicationDeadline" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobPosting_public_text_lengths_check" CHECK (
    char_length("title") BETWEEN 1 AND 200 AND
    char_length("summary") BETWEEN 1 AND 500 AND
    char_length("description") BETWEEN 1 AND 20000 AND
    char_length("responsibilities") BETWEEN 1 AND 12000 AND
    char_length("requirements") BETWEEN 1 AND 12000 AND
    ("benefits" IS NULL OR char_length("benefits") <= 8000) AND
    char_length("location") BETWEEN 1 AND 160
  ),
  CONSTRAINT "JobPosting_normalized_text_check" CHECK (
    char_length("normalizedTitle") BETWEEN 1 AND 200 AND
    char_length("normalizedLocation") BETWEEN 1 AND 160 AND
    char_length("searchDocumentNormalized") BETWEEN 1 AND 60000
  ),
  CONSTRAINT "JobPosting_salary_check" CHECK (
    (("salaryMin" IS NULL AND "salaryMax" IS NULL AND "salaryCurrency" IS NULL AND "salaryPeriod" IS NULL) OR
     ("salaryMin" IS NOT NULL AND "salaryMax" IS NOT NULL AND "salaryCurrency" ~ '^[A-Z]{3}$' AND "salaryPeriod" IS NOT NULL AND "salaryMin" >= 0 AND "salaryMax" >= "salaryMin"))
  ),
  CONSTRAINT "JobPosting_version_check" CHECK ("version" > 0),
  CONSTRAINT "JobPosting_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "JobPosting_publication_check" CHECK (
    "applicationDeadline" IS NULL OR "publishedAt" IS NULL OR "applicationDeadline" > "publishedAt"
  )
);

CREATE TABLE "JobPostingSkill" (
  "jobPostingId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobPostingSkill_pkey" PRIMARY KEY ("jobPostingId", "skillId"),
  CONSTRAINT "JobPostingSkill_values_check" CHECK (char_length("displayName") BETWEEN 1 AND 80 AND "position" >= 0)
);

CREATE TABLE "ApplicationQuestion" (
  "id" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "description" TEXT,
  "kind" "ApplicationQuestionKind" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "position" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationQuestion_values_check" CHECK (
    char_length("prompt") BETWEEN 1 AND 500 AND
    ("description" IS NULL OR char_length("description") <= 1000) AND
    "position" >= 0 AND "version" > 0 AND
    (("kind" = 'SINGLE_CHOICE' AND jsonb_typeof("options") = 'array' AND jsonb_array_length("options") BETWEEN 2 AND 20) OR
     ("kind" <> 'SINGLE_CHOICE' AND "options" IS NULL))
  )
);

CREATE TABLE "CandidateCv" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "confirmedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateCv_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidateCv_values_check" CHECK (
    char_length("displayName") BETWEEN 1 AND 200 AND
    char_length("fileName") BETWEEN 1 AND 255 AND
    "mimeType" IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') AND
    "byteSize" BETWEEN 1 AND 5000000 AND
    "checksumSha256" ~ '^[a-f0-9]{64}$' AND "version" > 0
  )
);

CREATE TABLE "SavedJob" (
  "userId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("userId", "jobPostingId")
);

CREATE TABLE "JobReport" (
  "id" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "reason" "JobReportReason" NOT NULL,
  "details" TEXT,
  "status" "JobReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "unresolvedKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "JobReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobReport_details_check" CHECK (
    ("details" IS NULL OR char_length("details") <= 2000) AND
    ("reason" NOT IN ('OTHER','MISLEADING','DISCRIMINATORY') OR char_length("details") BETWEEN 20 AND 2000)
  ),
  CONSTRAINT "JobReport_resolution_check" CHECK (
    ("status" = 'PENDING_REVIEW' AND "resolvedAt" IS NULL AND "unresolvedKey" IS NOT NULL) OR
    ("status" <> 'PENDING_REVIEW' AND "resolvedAt" IS NOT NULL AND "unresolvedKey" IS NULL)
  )
);

CREATE TABLE "JobApplication" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "selectedCvId" TEXT NOT NULL,
  "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
  "coverLetter" TEXT,
  "profileSnapshot" JSONB NOT NULL,
  "cvSnapshot" JSONB NOT NULL,
  "jobSnapshot" JSONB NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "submissionBindingDigest" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobApplication_values_check" CHECK (
    ("coverLetter" IS NULL OR char_length("coverLetter") <= 5000) AND
    char_length("consentVersion") BETWEEN 1 AND 64 AND
    char_length("idempotencyKey") BETWEEN 16 AND 128 AND
    "submissionBindingDigest" ~ '^[a-f0-9]{64}$' AND
    jsonb_typeof("profileSnapshot") = 'object' AND
    jsonb_typeof("cvSnapshot") = 'object' AND
    jsonb_typeof("jobSnapshot") = 'object' AND
    octet_length("profileSnapshot"::text) <= 262144 AND
    octet_length("cvSnapshot"::text) <= 32768 AND
    octet_length("jobSnapshot"::text) <= 131072
  )
);

CREATE TABLE "ApplicationAnswer" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "questionSnapshot" JSONB NOT NULL,
  "answer" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationAnswer_values_check" CHECK (
    jsonb_typeof("questionSnapshot") = 'object' AND
    jsonb_typeof("answer") IN ('string','boolean') AND
    octet_length("questionSnapshot"::text) <= 16384 AND
    octet_length("answer"::text) <= 8192
  )
);

CREATE TABLE "RecruitmentNotificationWork" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "audience" "RecruitmentNotificationAudience" NOT NULL,
  "kind" "RecruitmentNotificationKind" NOT NULL,
  "targetReference" TEXT NOT NULL,
  "payloadRef" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "safeErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentNotificationWork_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecruitmentNotificationWork_values_check" CHECK (
    char_length("targetReference") BETWEEN 1 AND 128 AND
    char_length("idempotencyKey") BETWEEN 1 AND 200 AND
    "attempts" >= 0 AND jsonb_typeof("payloadRef") = 'object' AND
    octet_length("payloadRef"::text) <= 16384
  )
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_verifiedAt_id_idx" ON "Company"("verifiedAt", "id");
CREATE UNIQUE INDEX "JobPosting_slug_key" ON "JobPosting"("slug");
CREATE INDEX "JobPosting_status_publishedAt_id_idx" ON "JobPosting"("status", "publishedAt" DESC, "id");
CREATE INDEX "JobPosting_status_applicationDeadline_id_idx" ON "JobPosting"("status", "applicationDeadline", "id");
CREATE INDEX "JobPosting_employmentType_experienceLevel_workArrangement_idx" ON "JobPosting"("employmentType", "experienceLevel", "workArrangement");
CREATE INDEX "JobPosting_salaryCurrency_salaryPeriod_salaryMax_id_idx" ON "JobPosting"("salaryCurrency", "salaryPeriod", "salaryMax" DESC, "id");
CREATE INDEX "JobPosting_companyId_status_id_idx" ON "JobPosting"("companyId", "status", "id");
CREATE INDEX "JobPosting_normalizedTitle_trgm_idx" ON "JobPosting" USING GIN ("normalizedTitle" gin_trgm_ops);
CREATE INDEX "JobPosting_normalizedLocation_trgm_idx" ON "JobPosting" USING GIN ("normalizedLocation" gin_trgm_ops);
CREATE INDEX "JobPosting_searchDocumentNormalized_trgm_idx" ON "JobPosting" USING GIN ("searchDocumentNormalized" gin_trgm_ops);
CREATE UNIQUE INDEX "JobPostingSkill_jobPostingId_position_key" ON "JobPostingSkill"("jobPostingId", "position");
CREATE INDEX "JobPostingSkill_skillId_jobPostingId_idx" ON "JobPostingSkill"("skillId", "jobPostingId");
CREATE UNIQUE INDEX "ApplicationQuestion_jobPostingId_position_key" ON "ApplicationQuestion"("jobPostingId", "position");
CREATE INDEX "ApplicationQuestion_jobPostingId_active_position_idx" ON "ApplicationQuestion"("jobPostingId", "active", "position");
CREATE UNIQUE INDEX "CandidateCv_storageKey_key" ON "CandidateCv"("storageKey");
CREATE INDEX "CandidateCv_candidateUserId_confirmedAt_archivedAt_idx" ON "CandidateCv"("candidateUserId", "confirmedAt", "archivedAt");
CREATE INDEX "SavedJob_userId_createdAt_idx" ON "SavedJob"("userId", "createdAt" DESC);
CREATE INDEX "SavedJob_jobPostingId_idx" ON "SavedJob"("jobPostingId");
CREATE UNIQUE INDEX "JobReport_unresolvedKey_key" ON "JobReport"("unresolvedKey");
CREATE INDEX "JobReport_jobPostingId_status_createdAt_idx" ON "JobReport"("jobPostingId", "status", "createdAt");
CREATE INDEX "JobReport_reporterUserId_createdAt_idx" ON "JobReport"("reporterUserId", "createdAt" DESC);
CREATE UNIQUE INDEX "JobApplication_candidateUserId_jobPostingId_key" ON "JobApplication"("candidateUserId", "jobPostingId");
CREATE UNIQUE INDEX "JobApplication_candidateUserId_idempotencyKey_key" ON "JobApplication"("candidateUserId", "idempotencyKey");
CREATE INDEX "JobApplication_jobPostingId_stage_submittedAt_idx" ON "JobApplication"("jobPostingId", "stage", "submittedAt");
CREATE INDEX "JobApplication_candidateUserId_submittedAt_idx" ON "JobApplication"("candidateUserId", "submittedAt" DESC);
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionId_key" ON "ApplicationAnswer"("applicationId", "questionId");
CREATE INDEX "ApplicationAnswer_questionId_idx" ON "ApplicationAnswer"("questionId");
CREATE UNIQUE INDEX "RecruitmentNotificationWork_idempotencyKey_key" ON "RecruitmentNotificationWork"("idempotencyKey");
CREATE UNIQUE INDEX "RecruitmentNotificationWork_applicationId_audience_kind_key" ON "RecruitmentNotificationWork"("applicationId", "audience", "kind");
CREATE INDEX "RecruitmentNotificationWork_status_nextAttemptAt_idx" ON "RecruitmentNotificationWork"("status", "nextAttemptAt");
CREATE INDEX "RecruitmentNotificationWork_applicationId_idx" ON "RecruitmentNotificationWork"("applicationId");

ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostingSkill" ADD CONSTRAINT "JobPostingSkill_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPostingSkill" ADD CONSTRAINT "JobPostingSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateCv" ADD CONSTRAINT "CandidateCv_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_selectedCvId_fkey" FOREIGN KEY ("selectedCvId") REFERENCES "CandidateCv"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ApplicationQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentNotificationWork" ADD CONSTRAINT "RecruitmentNotificationWork_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
