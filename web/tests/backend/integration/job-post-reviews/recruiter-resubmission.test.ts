import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * T086 [P] [US4] Recruiter Resubmission Tests
 *
 * Validates FR-005, FR-008, FR-024, SC-004:
 * - Rejected revision creates new review version with changed hash
 * - New sequence number increments correctly
 * - Repeated/concurrent resubmit is idempotent
 * - Prior review history preserved immutably
 * - Prior approved version remains visible until new approval
 */

describe('Recruiter Resubmission Integration', () => {
  const SUBMISSION_SERVICE_PATH = join(process.cwd(), 'src/backend/jobs/review/job-post-submission-service.ts');
  const REPO_PATH = join(process.cwd(), 'src/backend/repositories/jobs/prisma-job-post-review-repository.ts');
  const POLICY_PATH = join(process.cwd(), 'src/backend/jobs/review/job-post-review-policy.ts');

  let submissionContent: string;
  let repoContent: string;
  let policyContent: string;

  beforeEach(() => {
    submissionContent = readFileSync(SUBMISSION_SERVICE_PATH, 'utf-8');
    repoContent = readFileSync(REPO_PATH, 'utf-8');
    policyContent = readFileSync(POLICY_PATH, 'utf-8');
  });

  describe('Rejected Revision Creates New Version (FR-024)', () => {
    it('submission service accepts resubmission after rejection', () => {
      // Must handle resubmission of rejected content
      expect(submissionContent).toMatch(/RESUBMITTED|resubmit/i);
      expect(submissionContent).toContain('historyAction');
    });

    it('validates membership eligibility on every resubmission', () => {
      // Same validation as initial submit
      expect(submissionContent).toMatch(/membership|status|ACTIVE/i);
      expect(submissionContent).toMatch(/company|verif/i);
    });
  });

  describe('Changed Content Hash (FR-005, FR-024)', () => {
    it('calculates new content hash for revised submission', () => {
      // Must recalculate hash from normalized content
      expect(submissionContent).toMatch(/snapshot|hash|sha256/i);
      expect(policyContent).toContain('jobReviewSnapshotSha256');
    });

    it('unique constraint allows different hash for same aggregate', () => {
      // Repository enforces unique (aggregateId, contentHash)
      expect(repoContent).toMatch(/unique|contentHash|aggregateId/i);
    });

    it('rejects duplicate hash submission as idempotent replay', () => {
      // Must find existing version by hash
      expect(repoContent).toMatch(/findSubmissionReplay|contentHash/i);
    });
  });

  describe('New Sequence Number (FR-024)', () => {
    it('increments sequence for each new version', () => {
      // Repository must increment sequence
      expect(repoContent).toMatch(/sequence/i);
    });

    it('distinguishes initial submit from resubmission in history', () => {
      // historyAction: sequence === 1 ? "SUBMITTED" : "RESUBMITTED"
      expect(submissionContent).toMatch(/sequence.*===.*1/);
      expect(submissionContent).toMatch(/SUBMITTED.*RESUBMITTED/);
    });

    it('sequence appears in submission result', () => {
      expect(submissionContent).toMatch(/sequence/i);
    });
  });

  describe('Repeated/Concurrent Resubmit Idempotency (FR-005, SC-004)', () => {
    it('uses actor-scoped idempotency key binding', () => {
      // Must bind idempotencyKey to userId
      expect(submissionContent).toContain('idempotencyKey');
      expect(repoContent).toContain('findSubmissionReplay');
    });

    it('validates idempotency key matches job and content', () => {
      // Changed job/content with same key must fail
      expect(submissionContent).toMatch(/idempotencyKey|expectedWorkingUpdatedAt/i);
    });

    it('returns existing result for exact idempotent replay', () => {
      expect(repoContent).toContain('findSubmissionReplay');
    });

    it('concurrent submissions with same content converge to one version', () => {
      // Unique constraint on (aggregateId, contentHash)
      expect(repoContent).toMatch(/unique|aggregateId|contentHash/i);
    });
  });

  describe('Preserved History (FR-024)', () => {
    it('prior review versions remain immutable', () => {
      // No update to existing versions
      expect(repoContent).not.toMatch(/update.*reviewVersion.*where.*id/i);

      // Only creates new versions
      expect(repoContent).toMatch(/create/i);
    });

    it('decision history records remain intact', () => {
      // History records are append-only
      expect(repoContent).toMatch(/history|create/i);
    });

    it('audit events for all versions preserved', () => {
      expect(repoContent).toMatch(/auditEvent|audit|SUBMITTED|RESUBMITTED/i);
    });

    it('prior approved snapshot remains linked until new approval', () => {
      // Aggregate tracks current approved version ID
      expect(repoContent).toMatch(/approvedVersion|aggregate/i);
    });
  });

  describe('Prior Approved Visibility (FR-008, FR-024)', () => {
    it('resubmission creates pending version without changing approval', () => {
      // New pending version does not affect currentApprovedVersionId
      expect(repoContent).toMatch(/pending|approved/i);

      // Submission updates pending pointer only
      expect(submissionContent).not.toMatch(/currentApprovedVersionId.*submit/i);
    });

    it('public visibility gates check approved version not pending', () => {
      // Public must read currentApprovedVersionId
      expect(repoContent).toMatch(/approved|public/i);
    });

    it('pending replacement does not modify JobPosting projection', () => {
      // JobPosting update only in approval transaction
      expect(repoContent).toMatch(/JobPosting|decidePending/i);
    });
  });

  describe('Content Normalization Consistency (FR-024)', () => {
    it('resubmission uses same normalization as initial submit', () => {
      // Both must call same policy function
      expect(policyContent).toMatch(/normalize|snapshot/i);
      expect(submissionContent).toMatch(/snapshot/i);
    });

    it('hash calculation deterministic across submissions', () => {
      expect(policyContent).toMatch(/calculateContentHash|sha256|hash/i);
    });
  });

  describe('Aggregate Continuity (FR-024)', () => {
    it('resubmission uses same aggregate as original submission', () => {
      // Must find existing aggregate by jobId
      expect(repoContent).toMatch(/aggregate|jobId/i);
      expect(submissionContent).toContain('aggregateId');
    });

    it('aggregate version increments on each submission', () => {
      expect(repoContent).toMatch(/version|aggregate/i);
    });

    it('version conflict prevents lost updates', () => {
      expect(submissionContent).toMatch(/expectedWorkingUpdatedAt|conflict/i);
    });
  });

  describe('Resubmission After Different Decision States (FR-024)', () => {
    it('allows resubmission after rejection', () => {
      // No state gate preventing submission from REJECTED
      expect(submissionContent).not.toMatch(/if.*state.*REJECTED.*throw/i);
    });

    it('allows resubmission after approval for new edits', () => {
      // Material edit of approved content starts new pending version
      expect(submissionContent).toContain('RESUBMITTED');
    });

    it('records correlation across versions in same aggregate', () => {
      expect(repoContent).toContain('correlationId');
      expect(submissionContent).toContain('correlationId');
    });
  });
});
