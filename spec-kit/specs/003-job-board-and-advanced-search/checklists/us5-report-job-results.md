# Feature 003 US5 Report Job Results

**Recorded**: 2026-08-02  
**Use case**: UC-JOB-05  
**Priority / release class**: P2 / Should  
**Result**: PASS for the independent focused automated slice

## Automated Evidence

One focused Vitest invocation covered report persistence/policy behavior, the
protected `POST /api/jobs/{jobId}/reports` contract, and the accessible report
dialog.

Result: **3 test files passed; 6 tests passed; 0 failed**.

## Behaviors Observed

- Reason/detail rules, duplicate unresolved reports, account rate limiting,
  private persistence, audit behavior, and rollback are covered.
- Protected-boundary and neutral response behavior is contract-tested.
- Dialog conditionals, cancel/pending/retry, and focus restoration are covered.
- Report submission does not automatically change `JobPosting`.

## Gate Conclusion

US5 is green as an independently testable Should increment. Human moderation is
outside this group; accepting a report never claims that the posting has been
reviewed or removed.

---

## Requirements Dossier: US5: Report a Job Posting

**Use case**: UC-JOB-05
**Priority**: P2
**Release class**: Should
**Primary actor**: Authenticated eligible user
**Requirements**: FR-019 through FR-022, FR-031 through FR-034
**HTTP contract**: `POST /api/jobs/{jobId}/reports`

### Outcome

An authenticated actor can privately report a public job for a supported reason.
The report begins in `PENDING_REVIEW`, is abuse-controlled and audited, and
cannot automatically remove or change the posting.

### Preconditions and Input

- The protected boundary verifies the active session, ACTIVE account, same
  origin, CSRF proof, strict target ID, and strict request body.
- Supported reasons are `FRAUD`, `MISLEADING`, `DUPLICATE`, `DISCRIMINATORY`,
  `INAPPROPRIATE`, and `OTHER`.
- Details are bounded normalized plain text and are required only by the
  reason-specific contract; unsafe markup and unknown fields are rejected.

### Primary Flow

1. The actor opens the report dialog from an eligible detail page.
2. The dialog explains privacy and moderation behavior, collects a reason, and
   conditionally collects bounded details.
3. The service applies the database-backed account rate limit before persistence.
4. The target is resolved through the neutral public action boundary.
5. One transaction creates the private pending report and a privacy-minimized
   `job.report.submitted` audit event.
6. The actor receives a neutral acknowledgement; the posting remains unchanged
   pending an authorized human moderation workflow.

### Alternate and Failure Outcomes

| Condition                                           | Required outcome                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Missing/invalid reason-specific details             | Return validation feedback and create nothing.                                      |
| Same actor/job/reason already unresolved            | Return neutral `{ received: true, duplicate: true }`; create no duplicate.          |
| More than 5 accepted attempts in rolling 15 minutes | Return safe `429` and `Retry-After`; persist no report text in rate-limit evidence. |
| Target is missing/removed/non-public                | Return the neutral unavailable outcome; reveal no state.                            |
| Transaction fails                                   | Roll back report and audit together; allow a safe retry.                            |
| Report is accepted                                  | Do not change status, visibility, rank, or availability of `JobPosting`.            |

### Privacy, Audit, and Accessibility Rules

- Report identity/content is visible only to authorized moderation workflows,
  never to public or company Job Board projections.
- The unresolved uniqueness key and rate-limit digest contain no raw report text,
  IP address, cookie, credential, or unnecessary personal data.
- Audit records contain actor, action, target, result, correlation ID, and time,
  but omit report text and sensitive request data.
- Dialog semantics, conditional details, validation, cancel, pending state,
  acknowledgement, retry, and focus restoration work by keyboard and at 320 px.

### Independent Acceptance Matrix

- Submit every reason and detail rule; repeat an unresolved report; exceed the
  rolling limit; use another actor; remove the target; inject transaction failure.
- Inspect private persistence/audit, public/company projections, unchanged
  posting state, neutral responses, dialog behavior, and focus restoration.

### Traceability

- Tasks: T049-T055.
- Source: `prisma-job-report-repository.ts`, `job-report-service.ts`,
  `app/api/jobs/[jobId]/reports/route.ts`, `report-job-dialog.tsx`, and
  `job-detail.tsx`.
- Generated tests: report PostgreSQL integration, report contract, and report
  dialog component suites.

### Exit Gate

US5 is independently complete when all three focused suites pass, duplicate and
rate-limit behavior is neutral, report/audit persistence is atomic, and the job
cannot be automatically changed. It is a Should increment after the Must path.
