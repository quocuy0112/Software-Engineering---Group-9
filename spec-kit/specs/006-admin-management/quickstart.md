# Quickstart: Feature 006 Administration Management

This guide is the implementation and verification handoff for Feature 006. It
does not alter the approved feature specification. All commands below are
runnable; environment-gated journeys report `NOT RUN` rather than being counted
as passes when their controlled fixtures or external approvals are absent.

## 1. Prerequisites

- Node.js `24.18.x` and npm `11.16.x`
- Docker with the repository PostgreSQL service available
- Malware scanner and protected object-storage configuration suitable for the
  business-license evidence pipeline
- Local DNS/hosts support for these exact development origins:
  - `http://localhost:3001` for the Candidate surface
  - `http://console.admin.localhost:3001` for the administration console
  - `http://console.recruiter.localhost:3001` only as an entitlement
    destination; no Recruiter Manager UI is implemented by Feature 006
- One pre-provisioned Platform Administrator Grant associated with a user who
  has completed two-factor enrollment

## 2. Install and Validate the Existing Workspace

Run from the repository root:

```powershell
npm install
npm run env:init
npm run env:check
npm run db:up
npm run db:validate
npm run db:migrations:check
npm run db:deploy
```

React Admin 5.15.1 and its compatible MUI, Emotion, and React Router peers are
pinned in `web/package.json` and the root lockfile.

Migration directories use one repository-wide `NNN_snake_case` sequence. The
Feature 006 migrations are `016_admin_management` through
`020_verification_outbox_event_unique`. Environments that applied the former
timestamp-prefixed names must reconcile history once, before deployment:

```powershell
npm run db:migrations:reconcile-names -- --apply
npm run db:migrations:check
npm run db:deploy
```

The reconciliation command verifies every migration SQL checksum before it
renames only the corresponding `_prisma_migrations` history entry. It never
executes migration SQL and is idempotent. Do not manually edit migration
history or run `db:deploy` between pulling the renamed folders and completing
the reconciliation.

## 3. Required Local Configuration

Configure the application with an explicit allowlist containing all three
origins above. Do not derive an allowed origin from an arbitrary request host.
Configure separate protected-storage credentials, malware-scanner access,
notification delivery, and the audit-retention policy.

Before production validation, approve
`docs/policies/business-license-evidence.md` with named Legal, Security, and
Operations owners, and record the upstream Company Access Prerequisite producer
contract/version. Existing-company approval must remain disabled until its
producer/consumer integration test passes in the target environment.

The local environment must fail closed when any production-required evidence
protection setting is absent. A development-only storage adapter may be used
only when it preserves authorization checks, private object access, retention,
and audit behavior.

Run the release readiness gate after supplying the named policy approvals and
upstream prerequisite deployment record:

```powershell
npm run admin:evidence:check
```

## 4. Prepare Test Data

Use a controlled fixture or provisioning command to create:

1. one active Platform Administrator Grant with two-factor authentication;
2. one ordinary Candidate with at least two active sessions;
3. one suspended Candidate eligible for reinstatement;
4. two Companies with memberships covering OWNER, HR_MANAGER, RECRUITER, and
   HIRING_MANAGER roles;
5. one Company Membership that may be suspended and removed;
6. verification requests in every specified lifecycle state, including a
   safety-check failure and an item older than 24 hours in `PENDING_CHECKS`;
7. moderation reports for Candidate and Company Membership targets, including
   a duplicate submission within 24 hours;
8. pending notification work that can be forced through transient and
   permanent delivery failures.

The provisioning path is operational tooling, not an admin-console feature.
It must never permit a browser client to grant itself Platform Administrator
access.

Provision a grant only from a controlled operator shell:

```powershell
npm run admin:provision -- <verified-active-account-email>
```

Revoke a grant from the same controlled operator shell:

```powershell
npm run admin:revoke -- <administrator-account-email>
```

Revocation retains the grant record in `REVOKED` state, revokes only its
designated administration session, clears its administration two-factor proof,
and leaves the underlying Candidate account available. Running
`admin:provision` later reactivates the retained grant but does not restore the
old administration session; password and two-factor sign-in are required again.

## 5. Run the Feature Locally

Start the application:

```powershell
npm run dev
```

```powershell
npm run admin:worker
npm run admin:worker:probe
```

The worker must process dashboard snapshots, verification safety checks and
the 24-hour delayed-check transition, and security-notification retries. The
web process must remain authoritative for every privileged command even when
the worker is unavailable.

Open `http://console.admin.localhost:3001`. Confirm that an unauthenticated,
non-administrator, expired-grant, or non-two-factor session cannot render or
query protected console data.

## 6. Automated Verification

The following existing repository gates remain mandatory:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

```powershell
npm run test:admin-management
npm run test:admin-management:e2e
npm run perf:admin-management
```

The focused suite must include unit, contract, integration, accessibility,
architecture-boundary, security, concurrency, worker, and system tests. It
must validate the OpenAPI contract and the React Admin provider contract
against the same fixtures.

`test:admin-management:e2e` requires `ADMIN_E2E_READY=1` plus the controlled
identities described in section 4. Set `ADMIN_E2E_RELIABILITY_EVIDENCE` to an
NDJSON path while running T056, T074, and T097 to retain provider, retry,
commit-to-SENT, and session-enforcement measurements. Run
`perf:admin-management:reliability` with that same path in
`ADMIN_PERF_RELIABILITY_EVIDENCE` to produce the T140 reliability report.

`perf:admin-management` requires `ADMIN_PERF_ORIGIN`, exactly ten independently
authenticated administrator cookies encoded as a JSON string array in
`ADMIN_PERF_AUTH_COOKIES`, and `ADMIN_PERF_RELIABILITY_EVIDENCE`. It runs the
15-minute, 10-concurrent-administrator harness. CI runs the deterministic
performance evaluator self-test; a release still requires the full target-
environment run.

## 7. Acceptance Walkthrough

### Authentication and Trust Boundary

1. Sign in with valid administrator credentials and complete two-factor
   authentication.
2. Sign in from a second approved browser and verify that the previous
   administrator session is revoked; its next request must be rejected.
3. Let the step-up window expire, invoke each sensitive action, and verify that
   the existing session is challenged rather than replaced by another session
   mechanism.
4. Repeat protected requests outside React Admin and confirm that the server
   independently enforces grant state, two-factor state, exact origin, and
   action permissions.

### Dashboard Consistency and Performance

1. Change source data, wait for the snapshot worker, and confirm the displayed
   `calculatedAt` is no more than 60 seconds old.
2. Drill from every aggregate into its filtered list and verify that every list
   returns its own `calculatedAt`, requires the same state-definition version as
   the snapshot, and receives the originating snapshot ID/count only through
   in-memory navigation context.
3. Force source data to change between the total and drill-down; confirm the
   console preserves or labels the original snapshot rather than presenting
   mismatched values as current.
4. Measure the dashboard on the reference dataset and verify its usable state
   and drill-down targets satisfy SC-002 and SC-003.

### Accounts, Sessions, and Memberships

1. Revoke one Candidate session and verify only that session loses access.
2. Revoke all sessions, suspend, and reinstate an account using required
   rationale categories and length limits; verify immutable, correlated audit
   events and immediate server-side enforcement.
3. Submit two concurrent updates with the same version and verify exactly one
   succeeds while the stale operation receives a conflict response and fresh
   state.
4. Suspend and remove Company Memberships without changing the Candidate
   identity or other company memberships. Verify the last OWNER invariant and
   prerequisite checks cannot be bypassed.

### Verification Evidence

1. Submit a valid license and verify the request cannot be reviewed before its
   safety check succeeds.
2. Confirm preview and download use authenticated, short-lived byte responses,
   never a public object URL, and that access is denied after authorization is
   removed.
3. Exercise approve, request-changes, reject, cancel, resubmit, duplicate-tax-
   identifier, transient failure, permanent failure, and the 24-hour delayed
   safety-check transition.
4. For every accepted submission/resubmission receipt, cancellation,
   request-changes, rejection, approval, delay, and expiry event, confirm the
   state/history/audit effects and exactly one idempotent applicant row in the
   existing `EmailOutbox` commit together; retry each event and confirm no
   duplicate outbox row is created. Confirm these rows do not create
   `SecurityNotificationWork` or expose FR-022 manual-intervention fields.
5. Confirm concurrent approval produces one Company and one OWNER membership,
   with the loser receiving the current terminal state.

### Moderation and Notifications

1. Verify only qualifying relationships can submit reports and that denied
   company-member attempts do not disclose Candidate existence.
2. Submit a duplicate report within 24 hours and confirm the same neutral
   acknowledgement is returned without creating a second open report.
3. Assign, note, resolve, and dismiss reports while preserving private details
   and immutable history; confirm these moderation-only records create no
   Notification Work and notify no report target.
4. Force security-notification delivery failure through all retry attempts;
   confirm the original security action remains effective and the console
   exposes `MANUAL_INTERVENTION_REQUIRED` without leaking notification content
   to unauthorized users.

### Recruiter Boundary and Accessibility

1. Query the recruiter-origin entitlement boundary with zero, one, and several
   active memberships; confirm it returns only the specified neutral status,
   minimum company references, and Candidate/employer-verification
   destinations.
2. Confirm no recruiter dashboard, job, pipeline, applicant, analytics, or team
   management screen exists in this feature.
3. Complete all critical admin workflows using only a keyboard. Verify visible
   focus, meaningful accessible names, dialog focus trapping/restoration,
   status text/icons in addition to color, error summaries, and live-region
   announcements.

## 8. Release Evidence

Attach these artifacts to the Feature 006 release record:

- traceability result proving every FR in `spec.md` has a planned component and
  test location;
- OpenAPI and provider-contract validation output;
- authorization-matrix and exact-origin negative-test output;
- concurrency and idempotency test output;
- dashboard age/performance measurements;
- accessibility automation and keyboard walkthrough results;
- evidence-protection and notification retry/dead-letter test output;
- confirmation that no Recruiter Manager capabilities were introduced.

Record actual outcomes, timestamps, environment references, and external
blockers in `release-validation.md`. A skipped, gated, or manually unexecuted
journey is not a pass.
