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
4. Open a company detail page.
5. Confirm founding year, employee-derived size, industry, location, team-application entry point, and active public jobs are shown.
6. Confirm missing company fields show an unavailable state rather than fabricated values.

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

### 4. Owner reviews and rejects

1. Sign in as the verified company Owner.
2. Open Manage Team → Team Applications.
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
