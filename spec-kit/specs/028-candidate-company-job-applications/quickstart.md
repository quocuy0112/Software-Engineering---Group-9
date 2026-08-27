# Quickstart: Candidate Company and Team Applications

## Prerequisites

- Use a local development database with approved companies, active memberships, at least one active public ordinary job, and an open HR Manager or Recruiter team opportunity.
- Prepare two Candidate accounts and one verified Company Owner account.
- Prepare valid PDF and DOCX CV fixtures at or below 5,000,000 bytes, plus an invalid type and an oversized file.
- Use the project’s normal development and test commands from `web/package.json`.

## Validation scenarios

### 1. Browse and inspect a company

1. Sign in as Candidate.
2. Open the Company area.
3. Confirm approved company cards show name, logo/fallback, and description.
4. Enter a company name, industry, or location keyword and confirm only matching cards remain.
5. Move to another company page and confirm the keyword remains in the URL and result set.
6. Open a company detail page.
7. Confirm founding year, employee-derived size, industry, location, team-application entry point, and active public jobs are shown.
8. When the company has more than one job page, change pages and confirm the job filters and Find Jobs card/status treatment remain consistent.
9. Confirm missing company fields show an unavailable state rather than fabricated values.
10. Open a public company without an active Owner and confirm ordinary jobs remain visible while HR Manager/Recruiter team-application actions are unavailable.

### 2. Search ordinary company jobs

1. Enter a keyword in the company job search.
2. Select a location.
3. Confirm results satisfy both filters and belong only to the selected company.
4. Clear filters and confirm all active public jobs return.
5. Select an ordinary job and confirm navigation reaches the existing job detail page, not Team Applications.

### 3. Submit a team application

1. Open the company’s team-application entry point.
2. Select HR Manager or Recruiter and upload a valid CV.
3. Submit and confirm a TeamApplication is created with no membership, score, pipeline record, or invitation.
4. Repeat the same submission and confirm duplicate prevention returns the existing status.
5. Try an invalid file type and a file larger than 5,000,000 bytes; confirm no application is created.
6. For a company with an active Owner, confirm the Owner receives a localized in-app notification that opens Manage Team > Team Applications. Switch the workspace locale and confirm Company and Team Applications labels, statuses, errors, and dates change between English and Vietnamese.

### 4. Owner reviews and rejects

1. Sign in as the verified company Owner.
2. Open Manage Team > Team Applications.
3. Confirm only HR Manager/Recruiter team applications are listed.
4. Open a CV and confirm access is limited to the Owner and audited.
5. Reject once with a reason and once without a reason.
6. Confirm the candidate receives the corresponding rejection email and no invitation or membership is created.

### 5. Owner accepts and candidate joins

1. Open a pending TeamApplication as Owner.
2. Accept it and confirm the Owner must choose HR Manager or Recruiter.
3. Confirm one invitation is created and the candidate receives an email.
4. Retry the accept action and confirm no duplicate invitation/email is created.
5. Open the invitation as the matching Candidate account and accept it.
6. Confirm membership is created with the confirmed role only after acceptance.
7. Try an expired, revoked, reused, or wrong-account invitation and confirm no membership is created.

## Verification references

- Entity rules and transitions: [data-model.md](./data-model.md)
- User-facing and service contracts: [contracts/company-team-applications.openapi.yaml](./contracts/company-team-applications.openapi.yaml)
- Acceptance criteria: [spec.md](./spec.md)

## Automated verification status

The feature-specific checks completed on the implementation branch:

- TypeScript typecheck passed.
- Company discovery, Team Application, invitation, contract, unit, integration, security, frontend, retention, notification, and performance tests passed.
- The invitation end-to-end spec is included and is gated behind `RUN_COMPANY_TEAM_APPLICATIONS_E2E=1` because it requires seeded accounts, a running application, email delivery, and private CV storage.
- The full existing `test:job-board` suite still reports baseline/environment failures in the local private-document storage fixture, an existing notification assertion, an existing accessibility/localization mock, and an existing managed-job visibility source assertion. The feature-specific ordinary-job projection and navigation checks pass.
- Incremental verification for the Owner-availability and bilingual-copy refinement found no feature TypeScript errors; the source typecheck remains non-zero because this checkout lacks the existing `sharp` module. The targeted backend run passed 20 tests, while two existing suites were blocked by the missing `pg` module. Targeted lint and formatting checks passed; frontend component suites remain blocked by the repository's existing Vitest CSS-module resolution issue.

For a manual run, configure PostgreSQL, the normal email outbox worker, and the configured private CV storage first; then seed the approved company, active memberships, public jobs, open team roles, Owner, Candidate, and valid/invalid CV fixtures described above.
