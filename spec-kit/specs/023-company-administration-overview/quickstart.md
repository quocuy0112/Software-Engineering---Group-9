# Quickstart: Company Administration Overview

1. Start the local environment and sign in as a provisioned platform administrator.
2. Open `http://console.admin.localhost:3001/#/companies` and search by legal name or company ID.
3. Open a row and verify the company overview shows verification, membership, and activity summaries.
4. Verify zero/one active-owner fixtures show their respective warning.
5. Confirm a missing company returns the unavailable response.
6. Run the focused admin tests and TypeScript/lint checks from `web/`.

## Review-search validation

1. Ensure a Job Post Review with title `Web Developer` and a Verification Request with known applicant/company names exist.
2. In `#/job-post-reviews`, verify `web`, `Web`, `WEB`, `Web De`, and whitespace-padded variants all return `Web Developer`.
3. In `#/verification-requests`, verify lower-, upper-, and mixed-case partial applicant and company names return the same rows.
4. Verify an exact review/request/company/applicant reference and tax code returns its matching row only.
5. Combine the search input with state and assignment filters; verify pagination total and returned rows remain consistent.
6. Run focused repository/service tests, migration/backfill verification, lint, and TypeScript checks from `web/`.
