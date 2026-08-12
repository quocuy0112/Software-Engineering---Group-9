# Quickstart: Validate Recruiter Header Layout

**Feature**: Recruiter Base Role — Group 1 Header Layout Change

This guide describes the validation workflow to run after implementation. It does not cover employer-application form behavior, administrator review, recruiter workspace selection, workspace-switch animation, or job-post creation.

## Prerequisites

- Node.js 24.18.x
- PostgreSQL 16 with existing SmartHire migrations applied
- Dependencies installed in `web/`
- Candidate, Administrator, and Recruiter origins configured as required by Feature 006
- Test accounts/fixtures representing the four derived header states
- A fixed release-validation population of at least 100 Candidate accounts, with at least 25 accounts per confirmed state

From the repository root:

```powershell
Set-Location web
npm install
npm run db:validate
npm run db:status
```

Do not create a new migration for this feature. The plan defines a read-only projection over existing membership and verification records.

## Start the application

```powershell
Set-Location web
npm run dev
```

Open the Candidate origin on port 3001 and sign in with a Candidate test account.

## Required fixture matrix

Prepare account-scoped fixtures using existing test helpers or development seed mechanisms:

| Fixture | Existing data | Expected projection |
|---|---|---|
| Never applied | No qualifying active membership and no request | `NEVER_APPLIED` |
| Pending checks | Latest request `PENDING_CHECKS` | `PENDING_REVIEW` |
| Pending review | Latest request `PENDING_REVIEW` | `PENDING_REVIEW` |
| Changes requested | Latest request `CHANGES_REQUESTED` | `PENDING_REVIEW` |
| Resubmitted | Latest request `RESUBMITTED` | `PENDING_REVIEW` |
| Rejected | Latest request `REJECTED` | `REJECTED` |
| Cancelled/expired | Latest request `CANCELLED` or `EXPIRED` | `NEVER_APPLIED` |
| Approved and entitled | ACTIVE membership in an ACTIVE verified company | `APPROVED` |
| Stale approval | Latest request `APPROVED` but no qualifying active membership | `NEVER_APPLIED` |

The full validation population must also include every mapped lifecycle, no-request and deterministic timestamp-tie histories, active/inactive membership and company combinations, multi-company/cross-account cases, long profile values, and missing avatars.

## Initial and refreshed host-boundary validation

1. Request a public Candidate workspace page on the exact Candidate host and confirm the layout may proceed to session validation.
2. Repeat the page request on Admin, Recruiter, unknown, missing, and malformed hosts; confirm a neutral not-found response occurs before workspace context, session, profile, status service, or repository access.
3. Request `GET /api/recruiter/header-status` on the exact Candidate host and confirm it may proceed to session validation.
4. Repeat the API request on every rejected host class; confirm neutral 404 `UNAVAILABLE` before session, service, or repository access.
5. Confirm both paths use the same host-classification cases and cannot disagree about the configured Candidate host.

## Contract validation

For an authenticated Candidate session, request:

```text
GET /api/recruiter/header-status
```

Verify the response against [recruiter-header.openapi.yaml](./contracts/recruiter-header.openapi.yaml):

- request succeeds only on the exact configured Candidate host
- `Cache-Control: no-store` on `200`, `401`, `404`, and `503`
- exactly one four-state `state`
- matching `destinationKind` and `href`
- valid `observedAt`
- no account, company, membership, request, role, evidence, or session identifiers
- `401` without a valid session
- neutral `404 UNAVAILABLE` on the Admin, Recruiter, unknown, or malformed host before session/status reads
- `503 STATUS_UNAVAILABLE` when the authoritative read is unavailable

## Automated verification

Run the baseline gates:

```powershell
Set-Location web
npm run typecheck
npm run lint
npm run format
```

Run the feature suites after their planned files exist:

```powershell
Set-Location web
npx vitest run tests/shared/unit/contracts/recruiter-header-status.test.ts tests/backend/unit/auth/candidate-host-boundary.test.ts tests/backend/unit/recruiter-header tests/backend/contract/recruiter-header tests/backend/integration/recruiter-header tests/frontend/components/recruiter-header tests/frontend/components/dashboard/workspace-shell-recruiter-header.test.tsx tests/frontend/accessibility/recruiter-header tests/architecture/recruiter-header-boundaries.test.ts tests/security/recruiter-header tests/performance/recruiter-header
npx playwright test tests/system/e2e/recruiter-header
```

Run the existing regression suites that own the reused boundaries:

```powershell
Set-Location web
npm run test:admin-management
npm run test:profile-account
npm run test:job-board
```

Expected result: all commands exit successfully with no serious or critical accessibility finding.

Architecture coverage must additionally prove that only `web/src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts` imports Prisma for this feature, while the status service consumes an injected repository port.
It must also prove the workspace layout checks the shared Candidate-host predicate before `getWorkspaceContext()`, and that the host predicate itself reads neither session nor status dependencies.

## Component behavior matrix

Validate the UI mapping from [header-layout-contract.md](./contracts/header-layout-contract.md):

| State | Visible label | Enabled | Expected activation |
|---|---|---:|---|
| Never applied | `Post a Job` | Yes | Opens Employer Verification |
| Pending review | `Application Under Review` | No | No action |
| Rejected | `Reapply as Recruiter` | Yes | Opens Employer Verification |
| Approved | `Post a Job` | Yes | Opens Recruiter workspace handoff |
| Loading/unavailable | Placeholder only | No | No action |

For each known state, verify default, hover, active, focus-visible, revalidating, navigating, and disabled styling in light and dark themes.

## Keyboard and accessibility validation

1. Tab through the header.
2. Confirm order: theme toggle, profile, recruiter action.
3. For pending review, confirm the control receives focus, has a visible focus indicator, and is announced as disabled.
4. Attempt click, tap, Enter, and Space on pending review; confirm no navigation and no pressed state.
5. For enabled states, confirm Enter and Space initiate only one navigation attempt, then simulate a thrown, cancelled, or unchanged-route result and confirm the action becomes available for retry without reload.
6. Confirm the loading placeholder announces that recruiter status is being checked without announcing one of the four labels.
7. With a long truncated name/email, confirm pointer hover and keyboard focus expose both complete values without changing header layout; confirm the profile link's accessible description also includes them.
8. Confirm icons are decorative and status is not communicated by color alone.

## Responsive validation

Validate at 1440, 1024, 1023, 761, 760, 479, and 320 CSS pixels, plus 200% text zoom.

### Desktop

- `[theme] [profile] [action]` remains on one row.
- Gaps are 12 px and right inset is 24 px.
- Name/email independently ellipsize at 220 px.
- Search yields space without overlapping the action group.

### Tablet

- Gaps are 8 px and right inset is 16 px.
- Profile shows avatar/name; email is hidden.
- Name ellipsizes at 120 px.
- Action labels remain complete on one line.

### Mobile

- One row contains theme, avatar/name/email profile, then the rightmost action.
- Action label remains complete on one line.
- Profile name and email remain visible and independently ellipsized.
- If the row cannot fit, only the action row scrolls horizontally.
- The document and search area never scroll horizontally or overlap controls.
- Every control remains reachable by touch and keyboard.

## Live revalidation scenario

1. Keep a Candidate workspace page visible with a pending account.
2. Change the underlying verification/membership fixture through the existing administrator workflow or integration helper.
3. Confirm the action becomes temporarily non-actionable during revalidation.
4. Within the next visible 30-second refresh window, confirm the new label/destination appears without reordering theme/profile.
5. Simulate a failed status response and confirm the action becomes the reserved disabled placeholder.
6. Restore the endpoint, focus the window, and confirm the next valid projection replaces the placeholder.

## Navigation recovery validation

1. Start on a Candidate route other than Employer Verification and activate a never-applied or rejected action twice rapidly; confirm only one same-origin navigation is accepted.
2. Simulate a same-origin navigation exception, cancellation, same-route result, and unchanged pathname; confirm each releases the lock and a later activation succeeds.
3. Restore the document through `pageshow` and return focus/visibility after an external handoff is cancelled; confirm the approved action becomes available again.
4. Allow a successful external handoff; confirm unload discards transient navigation state and no navigation flag appears in browser storage.
5. Repeat with mouse, touch, Enter, and Space using controlled navigation adapters/events so results do not depend on timing.
6. Confirm the adapter receives only the destination from the confirmed projection and cannot select an alternate destination, construct a recruiter route, choose a company/workspace, represent destination progress/errors, change authorization, or animate a transition.

## Privacy and boundary checks

- Inspect the response, DOM, URLs, browser storage, and ordinary logs for fixture identifiers; none may appear except the safe destination URL.
- Confirm a wrong-host initial page request cannot begin workspace context, session, profile, status service, or repository access.
- Confirm the header never treats its projection as recruiter authorization.
- Confirm the recruiter origin denies stale or inactive membership independently.
- Confirm the status feature uses the existing opaque Better Auth cookie/session only, creates no second credential, and does not change expiry, logout, revocation, or password-reset behavior.
- Confirm Group 1 creates no verification request, membership, company, job post, audit event, or notification.

## Performance evidence

Run the dedicated measurement command after its planned script exists:

```powershell
Set-Location web
npm run perf:recruiter-header
```

Use the fixed population described above. Complete exactly 20 warm-ups and exactly 200 measured samples for each page-load and refresh measurement with 20 concurrent Candidate sessions.

For SC-002, start timing when authenticated Candidate workspace navigation starts. Stop on the first animation frame where theme and profile controls are visible and operable and the recruiter-action footprint is visible as either a confirmed action or the safe checking placeholder.

For refresh evidence, every sample starts from a confirmed state and changes to a different result whose label or availability differs. Across exactly 200 samples, use exactly 50 results for each state, 66 or 67 samples for each interval/focus/visibility trigger, and 16 or 17 samples for every trigger-result-state cell.

For SC-003, start timing when the client accepts the eligible refresh opportunity and stop on the first animation frame where the expected confirmed label and action availability are visible. Record `GET /api/recruiter/header-status` duration separately as a diagnostic; it is not the SC-003 result.

Retain machine-readable evidence containing:

- environment and server mode;
- representative dataset and database state;
- measurement method and warm-up policy;
- sample size, test duration, and concurrency;
- nearest-rank percentile calculation;
- P50, P95, P99, and maximum latency;
- error count/rate and relevant external-service conditions.

The validation fails if required metadata, exact sample counts, trigger/state quotas, transition conditions, or rendered-frame boundaries are absent; page-load P95 exceeds 3 seconds; end-to-end refresh P95 exceeds 2 seconds; unplanned errors exceed 0.5 percent; or visible polling exceeds one interval read per 30 seconds or overlaps requests. Host, authorization, privacy, and state correctness require 100 percent success.

## Usability evidence

Run this study only after responsive and accessibility presentation is final.

1. Recruit exactly 20 uncoached participants who used an online job-search or application service in the previous 12 months, can use the product language under test, did not implement or review this feature, and have not seen the study materials.
2. Include 10 primarily mobile and 10 primarily desktop/laptop job seekers, and assign exactly five participants to each confirmed state.
3. Begin timing when the complete header becomes visible.
4. Ask each participant to state their recruiter status and whether an action is available.
5. Record only the eligibility result, device cohort, state assignment, raw elapsed time, both answers, and pass/fail in `usability-validation.md`.
6. Pass SC-011 only when at least 18 of 20 participants answer both parts correctly within five seconds.

## Rollback check

Removing the action component, route, shared projection contract, shared host-predicate integration, and associated CSS/tests restores the prior header. No data rollback or migration reversal is required.
