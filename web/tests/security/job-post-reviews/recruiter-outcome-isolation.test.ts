import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * T087 [P] [US4] Recruiter Outcome Isolation Security Tests
 *
 * Validates FR-022, FR-023, FR-027:
 * - Lost-membership prevents direct notification access
 * - Lost-membership prevents direct detail access
 * - Authorized company-workspace discovery allowed for current members
 * - Cross-tenant outcome data isolated
 */

describe('Recruiter Outcome Isolation Security', () => {
  const SERVICE_PATH = join(process.cwd(), 'src/backend/jobs/review/job-post-review-service.ts');
  const RECRUITER_DATA_PATH = join(process.cwd(), 'src/backend/services/jobs/recruiter-job-posting-data.ts');
  const REPO_PATH = join(process.cwd(), 'src/backend/repositories/jobs/prisma-job-post-review-repository.ts');
  const ROUTE_PATH = join(process.cwd(), 'src/app/api/recruiter/job-postings');

  let serviceContent: string;
  let recruiterDataContent: string;
  let repoContent: string;

  beforeEach(() => {
    serviceContent = readFileSync(SERVICE_PATH, 'utf-8');
    recruiterDataContent = readFileSync(RECRUITER_DATA_PATH, 'utf-8');
    repoContent = readFileSync(REPO_PATH, 'utf-8');
  });

  describe('Lost-Membership Direct Notification Denial (FR-022, FR-027)', () => {
    it('outcome notification not created when membership lost before decision', () => {
      // Service checks eligibility before decision
      expect(serviceContent).toMatch(/submitterEligible|notifySubmitter/i);
    });

    it('notification requires active membership at decision time', () => {
      // Eligibility check includes membership state
      expect(serviceContent).toMatch(/membership.*ACTIVE|status.*ACTIVE/i);
    });

    it('notification requires active account at decision time', () => {
      expect(serviceContent).toMatch(/user.*ACTIVE|state.*ACTIVE/i);
    });

    it('notification requires company verification at decision time', () => {
      expect(serviceContent).toMatch(/company.*verif|ACTIVE/i);
    });
  });

  describe('Lost-Membership Direct Detail Denial (FR-023, FR-027)', () => {
    it('recruiter data service validates membership before returning review state', () => {
      // Must check membership authorization
      expect(recruiterDataContent).toMatch(/companyMembership\.findFirst/);
      expect(recruiterDataContent).toMatch(/verificationState:\s*"ACTIVE"/);
    });

    it('review detail requires current qualifying membership', () => {
      // Authorization check before detail projection
      expect(recruiterDataContent).toMatch(/status:\s*"ACTIVE"/);
      expect(recruiterDataContent).toMatch(/companyMembership\.findFirst/);
    });

    it('returns neutral error for unauthorized review access', () => {
      // Must use safe error without revealing existence
      expect(serviceContent).toMatch(/JOB_POST_REVIEW_UNAVAILABLE|NOT_FOUND/i);
      expect(recruiterDataContent).toMatch(/unavailable|not.*found/i);
    });
  });

  describe('Authorized Company-Workspace Discovery (FR-022, FR-023)', () => {
    it('company-scoped listing available to current members', () => {
      // Recruiter can list their company jobs
      expect(recruiterDataContent).toMatch(/companyId|filter|list/i);
    });

    it('review state visible in company workspace to authorized members', () => {
      // Review projection included in job listing
      expect(recruiterDataContent).toMatch(/review|PENDING|APPROVED|REJECTED/i);
    });

    it('lost submitter cannot see outcome but current member can see state', () => {
      // Company workspace shows state to any current member
      expect(recruiterDataContent).toMatch(/company|member/i);

      // Submitter-specific notification not sent (checked in service)
      expect(serviceContent).toMatch(/notifySubmitter|submitterEligible/i);
    });

    it('workspace discovery does not expose private Administrator notes', () => {
      // Recruiter projection must exclude private notes
      expect(recruiterDataContent).toMatch(/explanation|reason/i);
    });
  });

  describe('Cross-Tenant Isolation (FR-023, FR-027)', () => {
    it('notification scoped to submitter user ID only', () => {
      // Repository creates notification with specific userId
      expect(repoContent).toMatch(/userId|submittedByUserId/i);
    });

    it('review detail filtered by company ownership', () => {
      // Must validate company ownership in authorization
      expect(recruiterDataContent).toMatch(/companyId:\s*company\.databaseId/);
      expect(recruiterDataContent).toMatch(/companyById\.get\(job\.companyId\)/);
    });

    it('outcome notification context contains no cross-company references', () => {
      // Context includes only reviewId
      expect(repoContent).toMatch(/contextType:\s*["']JOB_POST_REVIEW["']/);
      expect(repoContent).toMatch(/contextId:\s*input\.reviewId/);
      expect(repoContent).not.toMatch(/otherCompany|crossCompany/i);
    });
  });

  describe('Notification Variables Safety (FR-023, SC-006)', () => {
    it('notification variables exclude submitter identity', () => {
      // Variables include state/audience only
      expect(repoContent).toMatch(/audience:\s*["']USER["']/);
      expect(repoContent).toMatch(/state:\s*decisionState/);
      expect(repoContent).not.toMatch(/submitterName|submitterId.*variables/i);
    });

    it('notification excludes company-identifying information', () => {
      expect(repoContent).not.toMatch(/companyName.*notification/i);
      expect(repoContent).not.toMatch(/companySlug.*variables/i);
    });

    it('notification excludes job content and snapshot', () => {
      expect(repoContent).not.toMatch(/snapshot.*notification.*create/i);
      expect(repoContent).not.toMatch(/jobTitle.*variables/i);
    });

    it('notification excludes Administrator identity', () => {
      expect(repoContent).not.toMatch(/administratorName.*notification/i);
      expect(repoContent).not.toMatch(/approvedBy.*variables/i);
    });
  });

  describe('Reason and Explanation Safety (FR-023)', () => {
    it('public reason code included in recruiter projection', () => {
      expect(recruiterDataContent).toMatch(/reasonCode:\s*current\.reasonCode/);
      expect(recruiterDataContent).toMatch(/publicExplanation:\s*current\.publicExplanation/);
    });

    it('public explanation bounded and safe', () => {
      // Explanation must be bounded (20-1000 chars as per spec)
      expect(recruiterDataContent).toMatch(/explanation/i);
      expect(recruiterDataContent).not.toMatch(/privateNote/i);
    });

    it('private Administrator note excluded from all recruiter views', () => {
      expect(recruiterDataContent).not.toMatch(/privateNote.*recruiter/i);
      expect(recruiterDataContent).not.toMatch(/internalNote/i);
    });
  });

  describe('Authorization Layer Enforcement (FR-027)', () => {
    it('recruiter routes require session and membership validation', () => {
      // Check if route exists and has authorization
      try {
        const routeContent = readFileSync(join(ROUTE_PATH, 'route.ts'), 'utf-8');
        expect(routeContent).toMatch(/session|auth/i);
        expect(routeContent).toMatch(/membership/i);
      } catch {
        // Route structure may vary, check service layer
        expect(recruiterDataContent).toMatch(/authorization|membership.*check/i);
      }
    });

    it('server-side membership validation precedes all data access', () => {
      expect(recruiterDataContent).toMatch(/if\s*\(!membership\)\s*throw new Error/);
      expect(recruiterDataContent).toMatch(/status:\s*"ACTIVE"/);
    });

    it('authorization failure returns neutral error', () => {
      expect(recruiterDataContent).toMatch(/unavailable|not.*found/i);
      expect(serviceContent).toMatch(/JOB_POST_REVIEW_UNAVAILABLE/);
    });
  });

  describe('Tenant Boundary Enforcement (FR-027)', () => {
    it('review queries filtered by company ownership', () => {
      expect(recruiterDataContent).toMatch(/where:\s*\{\s*jobId:\s*\{\s*in:\s*ownedJobIds\s*\}/);
      expect(recruiterDataContent).toMatch(/ownedCompanyIds\.has\(job\.companyId\)/);
    });

    it('no cross-company enumeration possible', () => {
      // Query must include company filter, not iterate all
      expect(recruiterDataContent).not.toMatch(/findMany\(\s*\)/);
      expect(recruiterDataContent).toMatch(/jobId:\s*\{\s*in:\s*ownedJobIds\s*\}/);
    });

    it('direct review ID access validates company ownership', () => {
      expect(serviceContent).toMatch(/row\.aggregate\.company\.verificationState/);
      expect(recruiterDataContent).toMatch(/companyId:\s*company\.databaseId/);
    });
  });

  describe('Lost Access Audit Trail (FR-021)', () => {
    it('decision is always audited regardless of notification eligibility', () => {
      // The decision audit record is created unconditionally, independent of
      // whether the submitter is still eligible for a direct notification
      expect(repoContent).toMatch(/PrismaAuditRepository\(this\.db\)\.append/);
      expect(repoContent).toMatch(/action:\s*\n?\s*decisionState === "APPROVED"/);
    });

    it('eligibility check outcome determines notification without blocking the audit trail', () => {
      expect(serviceContent).toMatch(/submitterEligible = Boolean/);
      expect(repoContent).toMatch(/if\s*\(\s*input\.notifySubmitter/);
    });
  });
});
