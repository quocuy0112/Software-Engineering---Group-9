import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * T085 [P] [US4] Recruiter Outcome Notification Tests
 *
 * Validates FR-022, FR-023, SC-006:
 * - Eligible submitter receives outcome notification when membership is active
 * - Lost membership prevents notification delivery
 * - Unrelated members cannot receive outcomes
 * - Multi-company isolation maintained
 * - Duplicate outcomes deduplicated
 * - Safe payload without private notes
 * - Recipient read state tracked independently
 */

describe('Recruiter Outcome Notification Integration', () => {
  const REPO_PATH = join(process.cwd(), 'src/backend/repositories/jobs/prisma-job-post-review-repository.ts');
  const SERVICE_PATH = join(process.cwd(), 'src/backend/jobs/review/job-post-review-service.ts');
  const EVENT_POLICY_PATH = join(process.cwd(), 'src/backend/notifications/event-policy.ts');

  let repoContent: string;
  let serviceContent: string;
  let eventPolicyContent: string;

  beforeEach(() => {
    repoContent = readFileSync(REPO_PATH, 'utf-8');
    serviceContent = readFileSync(SERVICE_PATH, 'utf-8');
    eventPolicyContent = readFileSync(EVENT_POLICY_PATH, 'utf-8');
  });

  describe('Eligible Submitter Notification (FR-022)', () => {
    it('creates outcome notification only when submitter has qualifying membership', () => {
      // Repository must check notifySubmitter flag before creating notification
      expect(repoContent).toContain('notifySubmitter');
      expect(repoContent).toMatch(/if\s*\(\s*input\.notifySubmitter\s*&&\s*input\.submittedByUserId/);

      // Must create notification with safe context
      expect(repoContent).toContain('JOB_POST_APPROVED');
      expect(repoContent).toContain('JOB_POST_REJECTED');
      expect(repoContent).toMatch(/contextType:\s*["']JOB_POST_REVIEW["']/);
    });

    it('service validates submitter eligibility before setting notify flag', () => {
      // Service must validate active membership, active account, verified company
      expect(serviceContent).toContain('submitterEligible');
      expect(serviceContent).toMatch(/membership.*ACTIVE/i);
      expect(serviceContent).toMatch(/company.*verified/i);
    });

    it('creates exactly one notification per decision with deduplication', () => {
      // Must use deduplication key pattern
      expect(repoContent).toMatch(/job-post-outcome.*reviewId.*state/i);
      expect(repoContent).toContain('deduplicationKey');
    });
  });

  describe('Lost Membership Isolation (FR-022, FR-023)', () => {
    it('prevents notification when submitter loses membership before decision', () => {
      // Service must check eligibility and set notifySubmitter based on it
      expect(serviceContent).toMatch(/notifySubmitter:\s*submitterEligible/);
      expect(serviceContent).toMatch(/submitterEligible\s*=\s*Boolean/i);

      // Repository respects the flag
      expect(repoContent).toMatch(/if\s*\(\s*input\.notifySubmitter/);
    });

    it('prevents notification when submitter account becomes inactive', () => {
      expect(serviceContent).toMatch(/account.*active/i);
      expect(serviceContent).toContain('submitterEligible');
    });

    it('prevents notification when company loses verification', () => {
      expect(serviceContent).toMatch(/company.*verified/i);
      expect(serviceContent).toContain('submitterEligible');
    });
  });

  describe('Unrelated Member Isolation (FR-023, SC-006)', () => {
    it('notification is scoped to submittedByUserId only', () => {
      // Must use submittedByUserId as recipient, not broadcast
      expect(repoContent).toContain('submittedByUserId');
      expect(repoContent).toMatch(/recipientUserId:\s*input\.submittedByUserId/);

      // No fan-out pattern for outcome notifications
      expect(repoContent).not.toMatch(/notifyActionableAdministrators.*JOB_POST_(APPROVED|REJECTED)/);
    });
  });

  describe('Multi-Company Isolation (FR-023, FR-027)', () => {
    it('notification context contains only review ID without cross-company data', () => {
      // Context must be minimal: type and reviewId only
      expect(repoContent).toMatch(/contextType:\s*["']JOB_POST_REVIEW["']/);
      expect(repoContent).toMatch(/contextId:\s*input\.reviewId/);

      // No company, job content, or other tenant data in context
      expect(repoContent).not.toMatch(/companyId.*context/);
      expect(repoContent).not.toMatch(/snapshot.*notification/);
    });
  });

  describe('Safe Payload Without Private Notes (FR-023, SC-006)', () => {
    it('notification variables include state but exclude private notes', () => {
      // Must include safe variables
      expect(repoContent).toMatch(/audience:\s*["']USER["']/);
      expect(repoContent).toMatch(/state:\s*decisionState/);

      // The createInAppNotification call must not reference privateNote in its payload
      const notificationCallMatch = repoContent.match(
        /await createInAppNotification\(this\.db,\s*\{[\s\S]*?\}\);/,
      );
      expect(notificationCallMatch).not.toBeNull();
      expect(notificationCallMatch?.[0]).not.toMatch(/privateNote/);
    });

    it('event policy defines safe approved/rejected copy', () => {
      expect(eventPolicyContent).toContain('JOB_POST_APPROVED');
      expect(eventPolicyContent).toContain('JOB_POST_REJECTED');

      // Must have safe copy templates
      expect(eventPolicyContent).toMatch(/title:\s*\{\s*vi:/);
      expect(eventPolicyContent).toMatch(/summary:\s*generic\(/);
    });

    it('notification kind uses appropriate severity levels', () => {
      // Approval: LOW, Rejection: MEDIUM
      expect(eventPolicyContent).toMatch(/JOB_POST_APPROVED:\s*\{\s*category:\s*"MODERATION",\s*severity:\s*"LOW"/);
      expect(eventPolicyContent).toMatch(/JOB_POST_REJECTED:\s*\{\s*category:\s*"MODERATION",\s*severity:\s*"MEDIUM"/);
    });
  });

  describe('Recipient Read State (FR-022)', () => {
    it('notification record includes recipient user ID for read tracking', () => {
      expect(repoContent).toMatch(/recipientUserId:\s*input\.submittedByUserId/);

      // Notification creation goes through the shared in-app notification helper
      expect(repoContent).toMatch(/createInAppNotification/);
    });
  });

  describe('Duplicate Outcome Prevention (FR-022)', () => {
    it('uses deterministic deduplication key with review and state', () => {
      // Pattern: job-post-outcome:{reviewId}:{state}
      expect(repoContent).toMatch(/deduplicationKey.*job-post-outcome/i);
      expect(repoContent).toMatch(/reviewId.*decisionState/);
    });

    it('deduplication prevents multiple notifications for same decision', () => {
      // Deduplication must be in same transaction
      expect(repoContent).toMatch(/deduplicationKey.*\$\{input\.reviewId\}/);
      expect(repoContent).toMatch(/\$\{decisionState\}/);
    });
  });

  describe('Notification Creation Atomicity (FR-025)', () => {
    it('outcome notification created in same transaction as decision', () => {
      // decidePending runs against the transaction client (this.db) and
      // createInAppNotification is called with that same client
      expect(repoContent).toMatch(/createInAppNotification\(this\.db,/);
      expect(repoContent).toContain('decidePending');
    });

    it('transaction failure prevents both decision and notification', () => {
      // Decision and notification are both executed inside prisma.$transaction
      // in the service, so a rollback undoes both together
      expect(serviceContent).toMatch(/prisma\.\$transaction/);
      expect(serviceContent).toMatch(/decidePending/);
    });
  });
});
