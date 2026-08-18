# Quickstart: Administrator Job Post Management Verification

## Prerequisites

1. Start PostgreSQL and the local application infrastructure with `npm run dev`.
2. Apply the feature migration using `npm run db:deploy`.
3. Have a verified company, active recruiter membership, one review-managed approved job, an active administrator grant, and the necessary job-management scopes.
4. Sign in at the Administrator Console with recent step-up verification.

Provision the minimum moderator scope, then explicitly add elevated scopes only
when the verification scenario needs them:

```powershell
npm run admin:provision -- recruiter-admin@example.test
npm run admin:provision -- content-admin@example.test --scope JOB_POST_FEATURE
npm run admin:provision -- senior-moderator@example.test --scope JOB_POST_ENFORCE
```

## Verification Scenarios

### Inspect and search

1. Open **Job Post Management** in the Administrator Console.
2. Search the approved job by title, company display name, and recruiter display name.
3. Filter by published/open, report count, approver, and featured state.
4. Verify detail identifies the live approved version, no pending revision, safe company/recruiter metadata, approval actor/time, independent operational states, report summary, and audit timeline.

### Independent lifecycle controls

1. Hide the published/open job with a reason; confirm candidate job search no longer returns it while administration still shows `HIDDEN` and `OPEN`.
2. Restore it, then close applications; confirm candidate detail remains visible but a new application is rejected.
3. Reopen applications only after confirming the company remains eligible and deadline is future.
4. Set a deadline in the past or invoke the lifecycle worker; confirm the job becomes `ARCHIVED`, remains auditable, and has no candidate visibility.

### Correction request and live revision integrity

1. Request changes without immediate hide and enter a public explanation.
2. Verify the recruiter sees the request, the current live content is still candidate-visible, and editing creates a pending revision.
3. Approve that revision from **Job Post Reviews**.
4. Verify detail now labels the new version live and retains the prior version in history.
5. Repeat with immediate hide and verify candidate visibility is withheld until authorized restoration.

### Featured capacity

1. Schedule an eligible job into `HOME_FEATURED` with a valid interval, priority, and reason.
2. Verify it appears as scheduled/active only within its interval and has an audit entry.
3. Fill placement capacity, then create an overlapping request; verify it fails with no partial row or displaced active feature.
4. Unfeature the job and verify ordinary lifecycle state remains unchanged.

### Reports and enforcement

1. Create or seed two pending reports for the same job.
2. From job detail, verify aggregated counts and authorized links to the reports.
3. Perform a hide enforcement and link both reports; verify both report details link to the same enforcement action and history remains immutable.
4. Repeat with another job-level enforcement; verify a report retains links to every resulting action.

## Automated Commands

```powershell
npm run db:validate
npm run typecheck
npm run test:job-post-management
npm run perf:job-post-management
npm run job-post-management:migration:verify
```

The feature adds the last two scripts. Run targeted unit, contract, integration, security, accessibility, and performance suites before broad regression tests.

## Recorded Validation

2026-08-16 local Docker validation passed:

1. `npm run db:deploy --workspace @smarthire/web`
2. `npm run job-post-management:migration:verify --workspace @smarthire/web`
3. `npm run typecheck --workspace @smarthire/web`
4. `npm run test:job-post-management --workspace @smarthire/web`
5. `npm run perf:job-post-management --workspace @smarthire/web -- --self-test`
6. `npm run typecheck --workspace @smarthire/web` after repository, feature-policy, enforcement, and notification changes.
7. `npm run test:job-post-management --workspace @smarthire/web` with 29 tests passing across contracts, integration, security, architecture, worker reliability, and component/accessibility boundaries.
8. `npm run build --workspace @smarthire/web` completed successfully. The build retains two unrelated dynamic-filesystem tracing warnings in the job-catalogue and business-evidence modules.

The Playwright flow at `web/tests/system/e2e/job-post-management/` is intentionally fixture-gated. Set `JOB_POST_MANAGEMENT_E2E_READY=1` only after provisioning the administrator, recruiter, candidate, and managed-job records described above.
