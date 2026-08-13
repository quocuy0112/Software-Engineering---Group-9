# Quickstart: Professional Connection Proposals

## Prerequisites

- PostgreSQL and required local dependencies are healthy.
- Feature 001 sessions, Feature 006 Platform Administrator console/worker/email infrastructure, Feature 006 Support Center, and Feature 008 messaging are available.
- Fixtures include one Platform Administrator, two ACTIVE participant accounts, one recruiter-only account, one inactive account, and optional Support case.

## Setup

```powershell
cd web
npm.cmd install
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate deploy
```

## Focused Validation

```powershell
npm.cmd run typecheck
npm.cmd run test:connections
```

Expected: contract, repository, authorization, lifecycle, notification, retention, UI, accessibility, security, architecture, and performance checks pass.

## Scenario 1: Bilateral Consent

1. Sign in to the exact administrator console as a Platform Administrator.
2. Open Professional Connection Proposals and select two distinct ACTIVE accounts.
3. Enter a participant-visible professional reason and keep the seven-day default expiry.
4. Create the proposal.
5. Verify no Feature 008 eligibility exists yet and both participants see `PENDING_BOTH` with symmetric notifications.
6. Accept as participant A; verify `PARTIALLY_ACCEPTED` and still no connection.
7. Accept as participant B; verify one `ACCEPTED` connection and Feature 008 discovery becomes available.

## Scenario 2: Decline Privacy

1. Create a fresh proposal for a different eligible pair.
2. Accept as one participant and decline as the other.
3. Verify terminal `DECLINED`, no connection, and neutral copy that does not identify who declined.
4. Verify re-proposal is rejected until the 30-day cooldown ends.

## Scenario 3: Abuse and Block Controls

1. Reach the three-active, five-received/30-day, and 20-admin/24-hour boundaries with controlled fixtures.
2. Verify the next creation fails safely with an authorized retry indication and no duplicate row.
3. Create a messaging block for an active proposal pair.
4. Verify the proposal becomes `CANCELLED`, neither participant can accept, and no output identifies the blocker.

## Scenario 4: Support Link

1. Open a Support Center case in the administrator Support Inbox.
2. Start a proposal linked to that case.
3. Verify the proposal stores only the case reference.
4. Close/reassign/delete retained case content and verify proposal state/reason remains governed only by Feature 011.
5. Verify participant/admin proposal outputs contain no support messages or internal notes.

## Scenario 5: Disconnect and Archive

1. Complete a proposal, open its Feature 008 conversation, and exchange messages.
2. Disconnect as either participant.
3. Verify the connection is `REVOKED`, composer/read-write/presence/typing are unavailable, and current sockets lose room authority.
4. Verify both original participants can open policy-retained history marked `READ_ONLY`.
5. Complete a later proposal after controls allow it and verify a new connection/conversation is created while old history stays archived.

## Scenario 6: Exact Retention

1. Create terminal fixtures immediately before, at, and after 90 and 365 days.
2. Verify ordinary detail suppression at exactly 90 days, independent of worker execution.
3. Use approved step-up access before 365 days and verify only the protected allowlist.
4. Run overlapping retention cycles at 365 days and verify idempotent deletion/scrubbing with a minimal tombstone.

## Regression and Release Gates

```powershell
npm.cmd run admin:contracts
npm.cmd run test:admin-management
npm.cmd run test:support
npm.cmd run test:messaging
npm.cmd run build
```

Also record targeted lint/format evidence, migration status, worker probe, concurrency counts, performance environment/dataset/percentiles/error rate, and exclusion of `.claude/settings.local.json` before the implementation commit.
