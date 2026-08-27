CREATE TYPE "JobTaxonomyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "JobTaxonomyProposalStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'MAPPED',
  'REJECTED'
);

CREATE TABLE "JobIndustry" (
  "id" VARCHAR(80) NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "normalizedName" VARCHAR(160) NOT NULL,
  "status" "JobTaxonomyStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobIndustry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobSubIndustry" (
  "id" VARCHAR(128) NOT NULL,
  "industryId" VARCHAR(80) NOT NULL,
  "code" VARCHAR(128) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "normalizedName" VARCHAR(160) NOT NULL,
  "status" "JobTaxonomyStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSubIndustry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobTaxonomyProposal" (
  "id" TEXT NOT NULL,
  "industryId" VARCHAR(80) NOT NULL,
  "companyId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "reviewVersionId" TEXT NOT NULL,
  "proposedName" VARCHAR(160) NOT NULL,
  "normalizedName" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "status" "JobTaxonomyProposalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "resolvedSubIndustryId" VARCHAR(128),
  "reviewedByAdminUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewReason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobTaxonomyProposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JobPosting"
  ADD COLUMN "industryId" VARCHAR(80),
  ADD COLUMN "subIndustryId" VARCHAR(128),
  ADD COLUMN "industryCode" VARCHAR(80),
  ADD COLUMN "subIndustryCode" VARCHAR(128);

CREATE UNIQUE INDEX "JobIndustry_code_key" ON "JobIndustry"("code");
CREATE UNIQUE INDEX "JobIndustry_normalizedName_key" ON "JobIndustry"("normalizedName");
CREATE INDEX "JobIndustry_status_sortOrder_id_idx" ON "JobIndustry"("status", "sortOrder", "id");

CREATE UNIQUE INDEX "JobSubIndustry_code_key" ON "JobSubIndustry"("code");
CREATE UNIQUE INDEX "JobSubIndustry_industryId_normalizedName_key" ON "JobSubIndustry"("industryId", "normalizedName");
CREATE INDEX "JobSubIndustry_industryId_status_sortOrder_id_idx" ON "JobSubIndustry"("industryId", "status", "sortOrder", "id");

CREATE UNIQUE INDEX "JobTaxonomyProposal_reviewVersionId_key" ON "JobTaxonomyProposal"("reviewVersionId");
CREATE INDEX "JobTaxonomyProposal_status_createdAt_id_idx" ON "JobTaxonomyProposal"("status", "createdAt", "id");
CREATE INDEX "JobTaxonomyProposal_industryId_normalizedName_status_idx" ON "JobTaxonomyProposal"("industryId", "normalizedName", "status");
CREATE INDEX "JobTaxonomyProposal_companyId_createdAt_idx" ON "JobTaxonomyProposal"("companyId", "createdAt");

CREATE INDEX "JobPosting_industryId_subIndustryId_status_publishedAt_id_idx"
  ON "JobPosting"("industryId", "subIndustryId", "status", "publishedAt" DESC, "id");
CREATE INDEX "JobPosting_industryCode_subIndustryCode_idx"
  ON "JobPosting"("industryCode", "subIndustryCode");

ALTER TABLE "JobSubIndustry"
  ADD CONSTRAINT "JobSubIndustry_industryId_fkey"
  FOREIGN KEY ("industryId") REFERENCES "JobIndustry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobTaxonomyProposal"
  ADD CONSTRAINT "JobTaxonomyProposal_industryId_fkey"
  FOREIGN KEY ("industryId") REFERENCES "JobIndustry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JobTaxonomyProposal_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JobTaxonomyProposal_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JobTaxonomyProposal_reviewVersionId_fkey"
  FOREIGN KEY ("reviewVersionId") REFERENCES "JobPostReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JobTaxonomyProposal_resolvedSubIndustryId_fkey"
  FOREIGN KEY ("resolvedSubIndustryId") REFERENCES "JobSubIndustry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_industryId_fkey"
  FOREIGN KEY ("industryId") REFERENCES "JobIndustry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JobPosting_subIndustryId_fkey"
  FOREIGN KEY ("subIndustryId") REFERENCES "JobSubIndustry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "JobIndustry" ("id", "code", "name", "normalizedName", "sortOrder")
VALUES
  ('r01', 'r01', 'Sales & Business Development', 'sales & business development', 1),
  ('r02', 'r02', 'Marketing / PR / Advertising / Communications', 'marketing / pr / advertising / communications', 2),
  ('r03', 'r03', 'Information Technology (IT)', 'information technology (it)', 3),
  ('r04', 'r04', 'Accounting / Auditing / Tax / Corporate Finance', 'accounting / auditing / tax / corporate finance', 4),
  ('r05', 'r05', 'Administration / Office / Executive Support / Legal', 'administration / office / executive support / legal', 5),
  ('r06', 'r06', 'Human Resources (HR)', 'human resources (hr)', 6),
  ('r07', 'r07', 'Electrical / Electronics / M&E / Energy', 'electrical / electronics / m&e / energy', 7),
  ('r08', 'r08', 'Mechanical / Automotive / Automation', 'mechanical / automotive / automation', 8),
  ('r09', 'r09', 'Construction / Architecture / Interior Design', 'construction / architecture / interior design', 9),
  ('r10', 'r10', 'Supply Chain / Logistics / Import-Export', 'supply chain / logistics / import-export', 10),
  ('r11', 'r11', 'Manufacturing / Assembly / Processing', 'manufacturing / assembly / processing', 11),
  ('r12', 'r12', 'Customer Service', 'customer service', 12),
  ('r13', 'r13', 'Design / Graphics / Creative Arts', 'design / graphics / creative arts', 13),
  ('r14', 'r14', 'Health, Safety & Environment (HSE)', 'health, safety & environment (hse)', 14),
  ('r15', 'r15', 'Finance / Banking / Securities', 'finance / banking / securities', 15),
  ('r16', 'r16', 'Insurance', 'insurance', 16),
  ('r17', 'r17', 'Real Estate', 'real estate', 17),
  ('r18', 'r18', 'Healthcare / Medical / Pharmaceuticals', 'healthcare / medical / pharmaceuticals', 18),
  ('r19', 'r19', 'Retail / Wholesale / Store Management', 'retail / wholesale / store management', 19),
  ('r20', 'r20', 'Hospitality / Restaurant / Tourism', 'hospitality / restaurant / tourism', 20),
  ('r21', 'r21', 'Education / Training', 'education / training', 21),
  ('r22', 'r22', 'E-Commerce', 'e-commerce', 22),
  ('r23', 'r23', 'Cosmetics / Spa / Beauty', 'cosmetics / spa / beauty', 23),
  ('r24', 'r24', 'Translation / Interpretation', 'translation / interpretation', 24),
  ('r25', 'r25', 'Media / Journalism / Publishing', 'media / journalism / publishing', 25),
  ('r26', 'r26', 'Textiles / Footwear / Fashion', 'textiles / footwear / fashion', 26),
  ('r27', 'r27', 'Agriculture / Forestry / Fisheries & Science', 'agriculture / forestry / fisheries & science', 27),
  ('r28', 'r28', 'General Labor & Drivers', 'general labor & drivers', 28),
  ('r29', 'r29', 'Other', 'other', 29)
ON CONFLICT ("id") DO NOTHING;

-- Keep the database key aligned with the application normalizer. This makes
-- punctuation/spacing variants such as "Product / Design" and "Product Design"
-- converge before the unique constraint is used by proposal approval.
UPDATE "JobIndustry"
SET "normalizedName" = btrim(regexp_replace(lower("name"), '[^a-z0-9]+', ' ', 'g'));

INSERT INTO "JobSubIndustry" ("id", "industryId", "code", "name", "normalizedName", "sortOrder")
VALUES
  ('r01-b2b-sales', 'r01', 'r01-b2b-sales', 'B2B Sales', 'b2b sales', 1),
  ('r01-b2c-sales', 'r01', 'r01-b2c-sales', 'B2C Sales', 'b2c sales', 2),
  ('r01-telesales-online-sales', 'r01', 'r01-telesales-online-sales', 'Telesales & Online Sales', 'telesales & online sales', 3),
  ('r01-business-development', 'r01', 'r01-business-development', 'Business Development', 'business development', 4),
  ('r01-sales-support', 'r01', 'r01-sales-support', 'Sales Support', 'sales support', 5),
  ('r01-distribution-agency-channel', 'r01', 'r01-distribution-agency-channel', 'Distribution & Agency Channel', 'distribution & agency channel', 6),
  ('r01-specialized-sales', 'r01', 'r01-specialized-sales', 'Specialized Sales', 'specialized sales', 7),
  ('r02-digital-marketing', 'r02', 'r02-digital-marketing', 'Digital Marketing', 'digital marketing', 1),
  ('r02-content-creation', 'r02', 'r02-content-creation', 'Content Creation', 'content creation', 2),
  ('r02-advertising-creative', 'r02', 'r02-advertising-creative', 'Advertising & Creative', 'advertising & creative', 3),
  ('r02-brand-trade-product-marketing', 'r02', 'r02-brand-trade-product-marketing', 'Brand / Trade / Product Marketing', 'brand / trade / product marketing', 4),
  ('r02-pr-events', 'r02', 'r02-pr-events', 'PR & Events', 'pr & events', 5),
  ('r02-market-research', 'r02', 'r02-market-research', 'Market Research', 'market research', 6),
  ('r03-software-development', 'r03', 'r03-software-development', 'Software Development', 'software development', 1),
  ('r03-it-product-project-management', 'r03', 'r03-it-product-project-management', 'IT Product & Project Management', 'it product & project management', 2),
  ('r03-software-testing-qa-qc', 'r03', 'r03-software-testing-qa-qc', 'Software Testing (QA/QC)', 'software testing (qa/qc)', 3),
  ('r03-data-ai', 'r03', 'r03-data-ai', 'Data & AI', 'data & ai', 4),
  ('r03-cybersecurity', 'r03', 'r03-cybersecurity', 'Cybersecurity', 'cybersecurity', 5),
  ('r03-infrastructure-networking-devops', 'r03', 'r03-infrastructure-networking-devops', 'Infrastructure, Networking & DevOps', 'infrastructure, networking & devops', 6),
  ('r03-it-operations-support', 'r03', 'r03-it-operations-support', 'IT Operations & Support', 'it operations & support', 7),
  ('r03-hardware-embedded-systems', 'r03', 'r03-hardware-embedded-systems', 'Hardware & Embedded Systems', 'hardware & embedded systems', 8),
  ('r04-accounting', 'r04', 'r04-accounting', 'Accounting', 'accounting', 1),
  ('r04-taxation', 'r04', 'r04-taxation', 'Taxation', 'taxation', 2),
  ('r04-auditing-internal-control', 'r04', 'r04-auditing-internal-control', 'Auditing & Internal Control', 'auditing & internal control', 3),
  ('r04-corporate-finance', 'r04', 'r04-corporate-finance', 'Corporate Finance', 'corporate finance', 4),
  ('r05-secretarial-executive-support', 'r05', 'r05-secretarial-executive-support', 'Secretarial & Executive Support', 'secretarial & executive support', 1),
  ('r05-general-administration', 'r05', 'r05-general-administration', 'General Administration', 'general administration', 2),
  ('r05-reception', 'r05', 'r05-reception', 'Reception', 'reception', 3),
  ('r05-data-entry-archiving', 'r05', 'r05-data-entry-archiving', 'Data Entry & Archiving', 'data entry & archiving', 4),
  ('r05-legal-compliance', 'r05', 'r05-legal-compliance', 'Legal & Compliance', 'legal & compliance', 5),
  ('r06-recruitment-talent-acquisition', 'r06', 'r06-recruitment-talent-acquisition', 'Recruitment / Talent Acquisition', 'recruitment / talent acquisition', 1),
  ('r06-learning-development', 'r06', 'r06-learning-development', 'Learning & Development', 'learning & development', 2),
  ('r06-compensation-benefits', 'r06', 'r06-compensation-benefits', 'Compensation & Benefits', 'compensation & benefits', 3),
  ('r06-hr-business-partner', 'r06', 'r06-hr-business-partner', 'HR Business Partner', 'hr business partner', 4),
  ('r06-general-hr-management', 'r06', 'r06-general-hr-management', 'General HR Management', 'general hr management', 5),
  ('r07-operations-maintenance', 'r07', 'r07-operations-maintenance', 'Operations & Maintenance', 'operations & maintenance', 1),
  ('r07-hvac-refrigeration', 'r07', 'r07-hvac-refrigeration', 'HVAC & Refrigeration', 'hvac & refrigeration', 2),
  ('r07-electronics-semiconductor', 'r07', 'r07-electronics-semiconductor', 'Electronics & Semiconductor', 'electronics & semiconductor', 3),
  ('r07-energy', 'r07', 'r07-energy', 'Energy', 'energy', 4),
  ('r07-electrical-me', 'r07', 'r07-electrical-me', 'Electrical & M&E', 'electrical & m&e', 5),
  ('r08-mechanical-engineering', 'r08', 'r08-mechanical-engineering', 'Mechanical Engineering', 'mechanical engineering', 1),
  ('r08-automotive', 'r08', 'r08-automotive', 'Automotive', 'automotive', 2),
  ('r08-automation', 'r08', 'r08-automation', 'Automation', 'automation', 3),
  ('r09-construction', 'r09', 'r09-construction', 'Construction', 'construction', 1),
  ('r09-estimation-design', 'r09', 'r09-estimation-design', 'Estimation & Design', 'estimation & design', 2),
  ('r09-architecture-interior-design', 'r09', 'r09-architecture-interior-design', 'Architecture & Interior Design', 'architecture & interior design', 3),
  ('r10-import-export', 'r10', 'r10-import-export', 'Import-Export', 'import-export', 1),
  ('r10-procurement', 'r10', 'r10-procurement', 'Procurement', 'procurement', 2),
  ('r10-transport-warehousing', 'r10', 'r10-transport-warehousing', 'Transport & Warehousing', 'transport & warehousing', 3),
  ('r10-supply-chain', 'r10', 'r10-supply-chain', 'Supply Chain', 'supply chain', 4),
  ('r11-operations-engineering', 'r11', 'r11-operations-engineering', 'Operations & Engineering', 'operations & engineering', 1),
  ('r11-quality-management', 'r11', 'r11-quality-management', 'Quality Management', 'quality management', 2),
  ('r11-production-labor', 'r11', 'r11-production-labor', 'Production Labor', 'production labor', 3),
  ('r12-call-center-cs', 'r12', 'r12-call-center-cs', 'Call Center & CS', 'call center & cs', 1),
  ('r12-management', 'r12', 'r12-management', 'Management', 'management', 2),
  ('r13-graphic-digital-design', 'r13', 'r13-graphic-digital-design', 'Graphic & Digital Design', 'graphic & digital design', 1),
  ('r13-fashion-product-design', 'r13', 'r13-fashion-product-design', 'Fashion & Product Design', 'fashion & product design', 2),
  ('r13-media-photography', 'r13', 'r13-media-photography', 'Media & Photography', 'media & photography', 3),
  ('r14-safety', 'r14', 'r14-safety', 'Safety', 'safety', 1),
  ('r14-environment', 'r14', 'r14-environment', 'Environment', 'environment', 2),
  ('r15-banking', 'r15', 'r15-banking', 'Banking', 'banking', 1),
  ('r15-securities-brokerage', 'r15', 'r15-securities-brokerage', 'Securities & Brokerage', 'securities & brokerage', 2),
  ('r15-investment-finance', 'r15', 'r15-investment-finance', 'Investment Finance', 'investment finance', 3),
  ('r16-insurance-general', 'r16', 'r16-insurance-general', 'Insurance', 'insurance', 1),
  ('r17-real-estate-general', 'r17', 'r17-real-estate-general', 'Real Estate', 'real estate', 1),
  ('r18-medical', 'r18', 'r18-medical', 'Medical', 'medical', 1),
  ('r18-pharmaceuticals', 'r18', 'r18-pharmaceuticals', 'Pharmaceuticals', 'pharmaceuticals', 2),
  ('r18-research', 'r18', 'r18-research', 'Research', 'research', 3),
  ('r19-retail-general', 'r19', 'r19-retail-general', 'Retail', 'retail', 1),
  ('r20-hotel-restaurant', 'r20', 'r20-hotel-restaurant', 'Hotel & Restaurant', 'hotel & restaurant', 1),
  ('r20-tourism', 'r20', 'r20-tourism', 'Tourism', 'tourism', 2),
  ('r21-education-general', 'r21', 'r21-education-general', 'Education', 'education', 1),
  ('r22-e-commerce-general', 'r22', 'r22-e-commerce-general', 'E-Commerce', 'e-commerce', 1),
  ('r23-beauty-spa-general', 'r23', 'r23-beauty-spa-general', 'Beauty & Spa', 'beauty & spa', 1),
  ('r24-translation-general', 'r24', 'r24-translation-general', 'Translation', 'translation', 1),
  ('r25-media-publishing-general', 'r25', 'r25-media-publishing-general', 'Media & Publishing', 'media & publishing', 1),
  ('r26-textiles-footwear-general', 'r26', 'r26-textiles-footwear-general', 'Textiles & Footwear', 'textiles & footwear', 1),
  ('r27-agriculture-science-general', 'r27', 'r27-agriculture-science-general', 'Agriculture & Science', 'agriculture & science', 1),
  ('r28-general-labor', 'r28', 'r28-general-labor', 'General Labor', 'general labor', 1),
  ('r28-drivers', 'r28', 'r28-drivers', 'Drivers', 'drivers', 2)
ON CONFLICT ("id") DO NOTHING;

UPDATE "JobSubIndustry"
SET "normalizedName" = btrim(regexp_replace(lower("name"), '[^a-z0-9]+', ' ', 'g'));

-- Prisma's @updatedAt is application-managed, matching the rest of this
-- schema. Defaults are used only while the seed rows are inserted above.
ALTER TABLE "JobIndustry" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "JobSubIndustry" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "JobTaxonomyProposal" ALTER COLUMN "updatedAt" DROP DEFAULT;
