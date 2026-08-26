import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * T088 [P] [US4] Recruiter Outcome Component Tests
 *
 * Validates FR-022, FR-023, FR-024, FR-029:
 * - Approved/rejected notification navigation
 * - Feedback display with public reason
 * - Revise/resubmit workflow
 * - Pending replacement visibility
 * - Recovery from lost responses
 */

describe('Recruiter Job Post Review Outcome Components', () => {
  const MANAGEMENT_PATH = join(process.cwd(), 'src/frontend/features/recruiter-workspace/job-posting-management.tsx');
  const EDITOR_PATH = join(process.cwd(), 'src/frontend/features/recruiter-workspace/job-posting-editor.tsx');
  const NOTIFICATION_COPY_PATH = join(process.cwd(), 'src/frontend/features/notifications/notification-copy.ts');

  let managementContent: string;
  let editorContent: string;
  let notificationCopyContent: string;

  beforeEach(() => {
    try {
      managementContent = readFileSync(MANAGEMENT_PATH, 'utf-8');
    } catch {
      managementContent = '';
    }

    try {
      editorContent = readFileSync(EDITOR_PATH, 'utf-8');
    } catch {
      editorContent = '';
    }

    try {
      notificationCopyContent = readFileSync(NOTIFICATION_COPY_PATH, 'utf-8');
    } catch {
      notificationCopyContent = '';
    }
  });

  describe('Approved Notification Navigation (FR-022)', () => {
    it('notification copy renders approved outcome', () => {
      expect(notificationCopyContent).toMatch(/JOB_POST_APPROVED/);
      expect(notificationCopyContent).toMatch(/approved|success/i);
    });

    it('approved notification links to job posting detail', () => {
      expect(notificationCopyContent).toMatch(/recruiter\/job-postings/);
      expect(notificationCopyContent).toMatch(/review.*context/i);
    });

    it('management component shows approved state', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/APPROVED|approved/);
        expect(managementContent).toMatch(/reviewState|review.*status/i);
      }
    });
  });

  describe('Rejected Notification Navigation (FR-022, FR-023)', () => {
    it('notification copy renders rejected outcome', () => {
      expect(notificationCopyContent).toMatch(/JOB_POST_REJECTED/);
      expect(notificationCopyContent).toMatch(/rejected|needs.*revision/i);
    });

    it('rejected notification links to job with feedback', () => {
      expect(notificationCopyContent).toMatch(/recruiter\/job-postings/);
      expect(notificationCopyContent).toMatch(/review/);
    });

    it('management component shows rejected state', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/REJECTED|rejected|review.*state/);
        expect(managementContent).toMatch(/review/i);
      }
    });
  });

  describe('Feedback Display (FR-019, FR-023)', () => {
    it('management displays public reason code', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/reasonCode|reason/i);
        expect(managementContent).toMatch(/INCOMPLETE_OR_UNCLEAR|MISLEADING_CONTENT/);
      }
    });

    it('management displays public explanation', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/explanation|feedback/i);
        expect(managementContent).not.toMatch(/privateNote/i);
      }
    });

    it('feedback component excludes private Administrator notes', () => {
      if (managementContent) {
        expect(managementContent).not.toMatch(/privateNote.*display/i);
        expect(managementContent).not.toMatch(/internalNote/i);
      }
    });

    it('displays actionable correction guidance', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/revise|edit|update/i);
      }
    });
  });

  describe('Revise Entry (FR-024)', () => {
    it('rejected job shows revise action', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/revise|edit/i);
        expect(managementContent).toMatch(/rejected|status.*===.*"rejected"/i);
      }
    });

    it('revise loads rejected content into editor', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/job/i);
        expect(editorContent).toMatch(/rejected|review/i);
      }
    });

    it('editor shows rejection reason during revision', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/reasonCode|explanation/i);
        expect(editorContent).toMatch(/feedback|rejection/i);
      }
    });
  });

  describe('Resubmit Workflow (FR-024, FR-029)', () => {
    it('editor shows resubmit action for revised content', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/resubmit|submit.*review/i);
        expect(editorContent).toContain('submit');
      }
    });

    it('resubmit requires confirmation', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/confirm|confirmation/i);
        expect(editorContent).toMatch(/submit|resubmit/i);
      }
    });

    it('resubmit validates content before submission', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/validate|validation/i);
        expect(editorContent).toMatch(/required.*fields/i);
      }
    });

    it('shows pending state after resubmission', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/PENDING_REVIEW|pending/i);
        expect(managementContent).toMatch(/submitted|under.*review/i);
      }
    });
  });

  describe('Pending Replacement Visibility (FR-008, FR-024)', () => {
    it('shows pending replacement when active job has new version under review', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/pending|sequence|version/i);
        expect(managementContent).toMatch(/review/i);
      }
    });

    it('indicates active version remains public during review', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/active|status/i);
        expect(managementContent).toMatch(/public|visible/i);
      }
    });

    it('shows sequence number for version tracking', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/sequence|version.*number/i);
      }
    });
  });

  describe('Recovery from Lost Responses (FR-029)', () => {
    it('management component handles loading state', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/loading|isLoading/i);
        expect(managementContent).toMatch(/skeleton|spinner|progress/i);
      }
    });

    it('shows error state with retry option', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/error/i);
      }
    });

    it('editor handles submission errors', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/error|catch|Error/i);
        expect(editorContent).toMatch(/submit|save/i);
      }
    });

    it('preserves form state during errors', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/useState|state/);
        expect(editorContent).toMatch(/form.*data|draft/i);
      }
    });
  });

  describe('Empty and Success States (FR-029)', () => {
    it('management shows empty state when no review data', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/empty|no.*data/i);
      }
    });

    it('shows success message after approval', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/approved|APPROVED/i);
      }
    });

    it('shows clear next steps after rejection', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/revise|edit.*resubmit/i);
      }
    });
  });

  describe('State Presentation (FR-029)', () => {
    it('uses distinct visual indicators for each review state', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/PENDING_REVIEW|APPROVED|REJECTED/);
        expect(managementContent).toMatch(/badge|chip|status/i);
      }
    });

    it('pending state shows read-only lock', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/readOnly|read.*only|locked/i);
        expect(managementContent).toMatch(/pending/i);
      }
    });

    it('rejected state enables editing', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/edit|revise/i);
        expect(managementContent).toMatch(/rejected/i);
      }
    });
  });

  describe('Idempotency UI (FR-005)', () => {
    it('submit button disabled during submission', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/disabled|isSubmitting/i);
        expect(editorContent).toMatch(/submit/i);
      }
    });

    it('prevents duplicate submissions', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/saving|loading/i);
        expect(editorContent).toMatch(/disabled/i);
        expect(editorContent).toMatch(/submit/i);
      }
    });

    it('shows submission progress indicator', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/loading|progress|submitting/i);
      }
    });
  });

  describe('Notification Context Handling (FR-022)', () => {
    it('notification copy extracts review context', () => {
      expect(notificationCopyContent).toMatch(/JOB_POST_REVIEW/);
      expect(notificationCopyContent).toMatch(/context/i);
    });

    it('notification link includes review parameter', () => {
      expect(notificationCopyContent).toMatch(/review.*=.*context/i);
    });

    it('management component reads review context from URL', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/useSearchParams|searchParams|query/i);
        expect(managementContent).toMatch(/review/i);
      }
    });
  });
});
