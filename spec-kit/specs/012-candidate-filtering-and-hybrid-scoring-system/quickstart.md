# Quickstart: Validate Submitted Candidates List & CV Access — Group 1

## Prerequisites

- Node.js 24.18.0, repository dependencies and PostgreSQL test database.
- Existing JobApplication/Applicant tracking migrations plus Feature 012 migration.
- Encrypted local application-document storage and retention worker; synthetic PDF/DOCX only.
- Seeded active verified company, active Recruiter membership, owned job and candidate sessions.

## 1. Submission, APPLIED and audit

Submit through existing `POST /api/jobs/{jobId}/applications` with a valid confirmed CV and each cover-letter variant. Verify one JobApplication, `APPLIED` version 1, initial stage event, exact immutable artifact/text, idempotency binding, promotion commit and allowlisted success audit commit together. Force validation, promotion and transaction failures; confirm no partial application, one content-minimized failure audit per attempt, immediate orphan denial and deletion within 24 hours. Advance the audit clock to the 365-day governing deadline and verify both success and failure attempt metadata are removed by the shared audit-retention process.

## 2. Duplicate and immutable evidence

Run concurrent matching submissions and conflicting idempotency reuse. Confirm exactly one candidate-job row; replay returns the original result; conflict never changes `submittedAt` or artifacts. Change CandidateCv/Profile afterward and compare downloaded bytes with the submission fixture.

## 3. Migration cutover

Seed backfillable, unverifiable, duplicate and legacy-hint cases. Verify preflight blocks duplicates/inconsistent stage; exact bytes alone backfill; unverifiable rows become legacy-unavailable; no current CV or synthetic row is substituted; original JobApplication ID/stage/history/time remain.

## 4. Populated unscored list

Seed 30 authoritative complete-document applications and traverse two pages. Verify `submittedAt DESC, id DESC`, no duplicate/omission, permitted identity/contact only, avatar fallback and no score/rank/filter/color. Wrong company or revoked membership returns neutral unavailable.

## 5. CV and cover letter

Preview PDF/text, download original PDF/DOCX, verify no-store/nosniff/safe disposition, DOCX preview fallback, absent `Not provided`, list-position/focus restoration and per-document outage isolation. No public URL or storage key may appear.

## 6. Empty versus failure

Verify successful zero rows shows the empty message; repository failure shows retry and never the empty state; recovery preserves job context.

## 7. Retention, erasure and legal hold

With a fake clock, test one instant before/at/after 12 months from the later job-close/terminal timestamp. At deadline, ordinary access fails even before worker execution. Verify purge within 30 days. Repeat for earlier erasure. Apply overlapping holds: access stays denied, deletion postpones minimally, and purge completes within 30 days after final release. Validate half-deadline warning, hard-deadline critical signal, lease loss and idempotent retry without content leakage.

## 8. Performance evidence

Seed exactly 10,000 authoritative complete-document applications for one job. Record environment, dataset construction, warm-up, sample size, test duration, concurrency, nearest-rank P50/P95/P99/max, maximum observed latency, error rate, and relevant external-service conditions. First/subsequent pages require P95 ≤2 seconds, at most 100 items and complete unchanged traversal.

## Required release checks

Run migration/preflight, worker probe, OpenAPI/Zod parity, typecheck, lint, focused unit/contract/integration/security/accessibility/architecture/performance suites, Feature 003/004/007 regressions, production build and Playwright. Confirm no Group 2–4 behavior or real candidate data.
