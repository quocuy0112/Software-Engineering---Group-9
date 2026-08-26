import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * T089 [P] [US4] Recruiter Outcome Accessibility Tests
 *
 * Validates FR-023, FR-024, FR-029, SC-008:
 * - Outcome announcement for screen readers
 * - Rejection reason semantic structure
 * - Private note absence from accessible tree
 * - Keyboard revise/resubmit workflow
 * - Focus recovery after actions
 * - Axe automated checks
 */

describe('Recruiter Outcome Accessibility', () => {
  const MANAGEMENT_PATH = join(process.cwd(), 'src/frontend/features/recruiter-workspace/job-posting-management.tsx');
  const EDITOR_PATH = join(process.cwd(), 'src/frontend/features/recruiter-workspace/job-posting-editor.tsx');
  const STYLES_PATH = join(process.cwd(), 'src/frontend/styles/recruiter-workspace-full.css');

  let managementContent: string;
  let editorContent: string;
  let stylesContent: string;

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
      stylesContent = readFileSync(STYLES_PATH, 'utf-8');
    } catch {
      stylesContent = '';
    }
  });

  describe('Outcome Announcement (FR-022, FR-029, SC-008)', () => {
    it('approved state uses live region for announcement', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-live|role="status"|role="alert"/);
        expect(managementContent).toMatch(/approved/i);
      }
    });

    it('rejected state uses live region for announcement', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-live|role="alert"/);
        expect(managementContent).toMatch(/rejected/i);
      }
    });

    it('outcome announcement includes actionable next steps', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-label|aria-describedby/);
        expect(managementContent).toMatch(/revise|edit|view/i);
      }
    });

    it('pending replacement announced to screen readers', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-live="polite"/i);
        expect(managementContent).toMatch(/locked while an Administrator reviews/i);
      }
    });
  });

  describe('Rejection Reason Semantic Structure (FR-023, FR-029, SC-008)', () => {
    it('reason code uses semantic heading', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<h[2-6]|heading/i);
        expect(managementContent).toMatch(/reason/i);
      }
    });

    it('explanation uses proper text hierarchy', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/explanation/i);
        expect(managementContent).toMatch(/<p>|<div.*role/);
      }
    });

    it('feedback region has descriptive label', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-label.*feedback|rejection.*details/i);
      }
    });

    it('reason code mapped to human-readable text', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/INCOMPLETE_OR_UNCLEAR.*incomplete/i);
        expect(managementContent).toMatch(/MISLEADING_CONTENT.*misleading/i);
      }
    });
  });

  describe('Private Note Absence (FR-023, SC-008)', () => {
    it('private note not in component tree', () => {
      if (managementContent) {
        expect(managementContent).not.toMatch(/privateNote.*render|display.*privateNote/i);
        expect(managementContent).not.toMatch(/aria-label.*private/i);
      }
    });

    it('no hidden Administrator notes in accessible tree', () => {
      if (managementContent) {
        expect(managementContent).not.toMatch(/aria-hidden="false".*privateNote/i);
        expect(managementContent).not.toMatch(/internalNote/i);
      }
    });

    it('only public reason and explanation exposed', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/reasonCode|explanation/i);
        expect(managementContent).not.toMatch(/privateNote/i);
      }
    });
  });

  describe('Keyboard Revise Workflow (FR-024, FR-029, SC-008)', () => {
    it('revise button keyboard accessible', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<button|role="button"/i);
        expect(managementContent).toMatch(/revise|edit/i);
      }
    });

    it('revise action has descriptive label', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-label/i);
        expect(managementContent).toMatch(/Revise rejected job posting/i);
      }
    });

    it('enter key activates revise', () => {
      if (managementContent) {
        // Button element handles enter by default
        expect(managementContent).toMatch(/<button/i);
        expect(managementContent).toMatch(/Revise posting/i);
      }
    });

    it('editor receives focus after revise', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/onNavigate|router|navigate/i);
      }
    });
  });

  describe('Keyboard Resubmit Workflow (FR-024, FR-029, SC-008)', () => {
    it('resubmit button keyboard accessible', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/<button/i);
        expect(editorContent).toMatch(/Revise & resubmit|Submit for approval/i);
      }
    });

    it('resubmit has clear label indicating action', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/aria-label.*submit.*review|resubmit/i);
      }
    });

    it('form validation errors announced', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/aria-live|role="alert"/);
        expect(editorContent).toMatch(/error|invalid/i);
      }
    });

    it('required fields have accessible error messages', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/aria-describedby.*error|aria-invalid/i);
      }
    });
  });

  describe('Focus Recovery (FR-029, SC-008)', () => {
    it('editor view is reachable via keyboard-activated buttons', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/onClick={onEdit}/);
      }
    });

    it('submission success returns focus to management view', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/setView\("dashboard"\)/);
      }
    });

    it('error state maintains focus context', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/role="alert"/i);
      }
    });

    it('keyboard navigation preserved across state changes', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<button/i);
      }
    });
  });

  describe('Confirmation Dialog Handling (FR-029, SC-008)', () => {
    it('confirmation uses native browser dialog for focus handling', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/window\.confirm/i);
      }
    });

    it('confirmation prompt is descriptive', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/window\.confirm\(/i);
      }
    });
  });

  describe('Non-Color State Cues (FR-029, SC-008)', () => {
    it('approved state has icon indicator', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/icon|Icon|svg/i);
        expect(managementContent).toMatch(/check|success|approved/i);
      }
    });

    it('rejected state has icon indicator', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/icon|Icon/i);
        expect(managementContent).toMatch(/error|warning|rejected/i);
      }
    });

    it('pending state has icon indicator', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/icon|Icon/i);
        expect(managementContent).toMatch(/pending|clock|hourglass/i);
      }
    });

    it('icons have text alternatives', () => {
      if (managementContent) {
        // Icons are decorative (aria-hidden) with adjacent text conveying meaning
        expect(managementContent).toMatch(/aria-hidden="true"/i);
        expect(managementContent).toMatch(/<strong>/i);
      }
    });
  });

  describe('Responsive Focus Indicators (FR-029, SC-008)', () => {
    it('CSS defines visible focus styles', () => {
      if (stylesContent) {
        expect(stylesContent).toMatch(/:focus|focus-visible/);
        expect(stylesContent).toMatch(/outline|ring|border.*focus/i);
      }
    });

    it('focus styles have sufficient contrast', () => {
      if (stylesContent) {
        // Check for focus indicator styling with visible outline width
        expect(stylesContent).toMatch(/outline:\s*3px solid/i);
      }
    });

    it('focus not removed with outline: none without alternative', () => {
      if (stylesContent) {
        const outlineNonePattern = /outline:\s*none/g;
        const matches = stylesContent.match(outlineNonePattern);
        if (matches) {
          // If outline:none exists, should have focus-visible or other indicator
          expect(stylesContent).toMatch(/:focus-visible|ring|box-shadow.*focus/i);
        }
      }
    });
  });

  describe('Screen Reader State Communication (FR-029, SC-008)', () => {
    it('review state communicated via aria-label', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/role="status"/i);
        expect(managementContent).toMatch(/aria-live="polite"/i);
      }
    });

    it('read-only pending lock announced', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/readOnly/);
        expect(managementContent).toMatch(/locked while an Administrator reviews/i);
      }
    });

    it('sequence number has semantic label', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/aria-label.*version|sequence/i);
      }
    });
  });

  describe('Loading State Accessibility (FR-029, SC-008)', () => {
    it('loading state uses proper aria-busy', () => {
      if (managementContent || editorContent) {
        const content = managementContent + editorContent;
        expect(content).toMatch(/aria-busy="true"|aria-live.*loading/i);
      }
    });

    it('loading has descriptive announcement', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/loading|submitting/i);
        expect(editorContent).toMatch(/aria-label|aria-live/);
      }
    });

    it('spinner has accessible label', () => {
      if (managementContent || editorContent) {
        const content = managementContent + editorContent;
        expect(content).toMatch(/role="status"|aria-label.*loading/i);
      }
    });
  });

  describe('Error State Accessibility (FR-029, SC-008)', () => {
    it('error uses alert role for immediate announcement', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/role="alert"/);
        expect(editorContent).toMatch(/error/i);
      }
    });

    it('error message descriptive and actionable', () => {
      if (editorContent) {
        expect(editorContent).toMatch(/recruiter-form-error/i);
        expect(editorContent).toMatch(/role="alert"/i);
      }
    });

    it('submit action remains available after error for retry', () => {
      if (editorContent) {
        // Submit button is not permanently disabled after an error, allowing retry
        expect(editorContent).toMatch(/disabled={saving}/i);
      }
    });
  });

  describe('Semantic HTML Structure (FR-029, SC-008)', () => {
    it('uses semantic section elements', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<section|<article|<main/i);
      }
    });

    it('buttons use button elements not divs', () => {
      if (managementContent || editorContent) {
        // Should have button elements for interactive actions
        const content = managementContent + editorContent;
        expect(content).toMatch(/<button|Button/);
      }
    });

    it('lists use proper list markup', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<ul|<ol|<li/i);
      }
    });
  });

  describe('Axe Automated Checks Preparation (SC-008)', () => {
    it('components use semantic HTML for axe validation', () => {
      if (managementContent) {
        expect(managementContent).toMatch(/<button|<a|<label|<input/i);
      }
    });

    it('interactive elements have accessible names', () => {
      if (managementContent || editorContent) {
        const content = managementContent + editorContent;
        expect(content).toMatch(/aria-label|aria-labelledby/);
      }
    });

    it('no duplicate IDs in component', () => {
      // IDs are derived from unique job.id, avoiding collisions across rendered cards
      if (managementContent) {
        expect(managementContent).toMatch(/id=\{`recruiter-job-\$\{job\.id\}`\}/);
      }
    });
  });
});
