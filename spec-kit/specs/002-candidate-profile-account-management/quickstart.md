# Quickstart: Validate Candidate Profile and Account Management

This guide validates Feature 002 end to end. It is not implementation code.
The expected architecture is:

```text
Browser / Server Component
  -> Next.js App Router Route Handler or in-process service
  -> Service
  -> Repository / Better Auth gateway / outbox boundary
  -> PostgreSQL 16.12
```

Better Auth 1.6.25 remains the only browser-session and credential owner.

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x`, selected by the root version files.
- Docker Desktop or a compatible Docker Compose runtime.
- The single root npm workspace and `package-lock.json`.
- PostgreSQL 16.12 through root Compose on `localhost:55432`; no host
  PostgreSQL or host `psql` is required.
- The Feature 001 identity migrations and runtime are working.
- Local `EMAIL_ADAPTER=capture` and the email worker; SMTP/Resend are not
  required for routine validation.
- Exact existing package pins from `web/package.json`.
- Planned server-only additions `sanitize-html` 2.17.6 and
  `@types/sanitize-html` 2.16.1 resolved through the sole root lockfile.
- Generated local `AUDIT_TRUSTED_PROXY_HOPS=0`; this mode permits only the
  direct loopback marker or controlled test fixtures and is forbidden in
  production. Production validation requires the documented trusted proxy
  chain.
- A controlled Clock and isolated test accounts/sessions.

## Local Setup

From the repository root:

```bash
npm run env:init
npm ci
npm run db:up
npm run env:check
npm run db:migrate
npm run db:verify
npm run dev
```

Open `http://localhost:3001`. The root development command starts Next.js and
the existing due-outbox worker. Captured messages are written beneath the
configured `EMAIL_CAPTURE_DIR`.

Do not commit `.env`, `web/.env.local`, captured email, proofs, logs, coverage,
or test output. Do not use `npm run db:reset` during routine validation because
it deletes the local PostgreSQL volume.

## Migration Gate

Before functional tests:

1. Run `npm run db:verify` against an empty temporary database and an upgraded
   Feature 001 database.
2. Confirm the migration creates exactly one CandidateProfile per existing
   CandidateIdentity and future registration creates both in one transaction.
3. Confirm no second user, credential, browser-session, or audit table exists.
4. Inspect the reviewed SQL for:
   - profile child FKs and ordering uniques;
   - unique normalized skills;
   - pending email-change partial unique indexes;
   - account-security preference CHECK;
   - PasswordChange operation/window constraints;
   - nullable protected outbox recipient fields;
   - safe enum additions.
5. Verify migration rollback/recovery documentation without editing an applied
   Feature 001 migration.
6. Confirm registration and email-change code share the normalized-email
   advisory-lock helper.

## Static and Contract Gates

From the root:

```bash
npm run typecheck
npm run lint
npm run test:unit --workspace @smarthire/web
npm run test:contract --workspace @smarthire/web
npm run build
```

Expected static evidence:

- `contracts/openapi.yaml` validates as OpenAPI 3.1.
- All `/api/account/**` handlers are App Router Route Handlers and contain no
  direct Prisma business operations.
- Strict input schemas reject unknown ownership properties.
- Profile/account client modules do not import Prisma, Better Auth server code,
  `sanitize-html`, provider adapters, or server secrets.
- `sanitize-html` is imported only by the server plain-text boundary.
- No profile renderer uses `dangerouslySetInnerHTML`.
- No Feature 002 browser storage contains profile, email proof, password,
  session, CSRF, or audit data.
- `npm audit --json` has no unreviewed critical/high finding after the new exact
  pins.

## Automated Validation

Run the full reproducible sequence:

```bash
npm run env:check
npm run db:verify
npm run typecheck
npm run lint
npm test
npm run test:e2e --workspace @smarthire/web -- --project=desktop-chromium
npm run test:e2e --workspace @smarthire/web -- --project=mobile-320
npm run build
npm run perf:pages --workspace @smarthire/web
```

PostgreSQL integration tests, not mocks or SQLite, are required for row locks,
advisory locks, partial unique indexes, concurrent proof consumption, and
session revocation.

## Critical Walkthrough 1: Professional Profile

1. Register and verify two accounts, A and B. Sign in as A.
2. Open `/profile`. Confirm a valid empty Profile with a "not filled yet"
   message and edit action, not an error or blank state.
3. Save basics with Vietnamese diacritics. Add/reorder/remove skills,
   experience, education, and social links using an explicit Save per section.
4. Reload. Confirm all child structures, stable IDs, order, and relationships
   remain intact and only A can see them.
5. Reach exact limits: 50 skills, 50 experiences, 50 education entries, and 10
   links. Confirm all return in one complete aggregate. Confirm item 51/11 is
   rejected with prior state unchanged.
6. Enter skills with surrounding/repeated whitespace and different casing.
   Confirm one normalized catalog skill and no case-only duplicate, while the
   selected display capitalization and Vietnamese diacritics remain.
7. Submit script/style/event-handler markup in every free-text kind. Confirm
   script content is absent from PostgreSQL, no markup executes in a supported
   browser, and normalization/validation feedback is visible and announced.
8. Test 7/15 digit phone boundaries, unsafe schemes, embedded URL credentials,
   duplicate canonical links, future starts, contradictory current/end dates,
   and education expected-completion dates.
9. Load the same revision in sessions A1 and A2. Save A1, then save valid stale
   A2. Confirm A2 wins, receives `conflictApplied: true`, sees a warning toast
   and persistent warning, and the revision increases serially.
10. Attempt reads/writes from B using A's profile and every nested child ID.
    Confirm no A data is returned or changed and the response does not reveal
    whether an ID exists.
11. Inject a persistence failure midway through a section save. Confirm the
    previous aggregate/revision remains authoritative and no orphan rows exist.

## Critical Walkthrough 2: Identity and Email Change

1. Open `/profile/account` as A. Confirm the form contains only account name,
   current email, and safe read-only account metadata; professional fields are
   in the separate Profile resource.
2. Save a 150-character valid Unicode name and reload. Confirm sanitization,
   accessible feedback, and the updated workspace projection.
3. Request a new unique email with the existing current-password recent-auth
   proof. Confirm one 30-minute pending reservation, one verification outbox row
   to the new address, one security alert to the old address, and an allowlisted
   audit event commit before `202`.
4. Retry the identical request with the same Idempotency-Key. Confirm it returns
   the existing accepted result with no replacement proof or duplicate outbox
   row; reuse the key for another email and confirm conflict.
5. Stop the worker before the request. Confirm account state is still
   consistent and delivery resumes through the normal outbox path when the
   worker restarts.
6. Before verification, confirm only the old email logs in and recovers the
   account. The pending email must not authenticate.
7. Inspect the captured verification link. Confirm the proof is in the URL
   fragment, the page removes it from the address bar, GET navigation performs
   no mutation, and logs contain no proof/full secret URL.
8. Verify once. Confirm the UserAccount email changes atomically, the old email
   stops logging in, the new email works, and repeat consumption is harmless.
9. Request two changes for A. Confirm only the newest remains usable and the
   earlier request is `SUPERSEDED`.
10. Race A and B for the same free email at request time and at verification
   time. Confirm at most one effective/pending claim exists and the loser keeps
   its prior email.
11. Race registration against an active pending reservation. Confirm the shared
    claim lock prevents the same normalized email from crossing the two tables.
12. Test malformed, expired, consumed, superseded, and newly conflicted proofs.
    Confirm safe messages, no identity mutation, and required audit outcomes.
13. Open A's proof page while signed in as B. Confirm the proof remains bound to
    A and never applies to B by session inference.

## Critical Walkthrough 3: Preferences

1. Use an account with no AccountPreferences row. Open
   `/profile/preferences`; confirm `vi`, `Asia/Ho_Chi_Minh`, and all three email
   categories enabled without a read-time database insert.
2. Save `en`, another valid IANA timezone, and both permitted notification
   changes. Sign in on another device and confirm identical persisted values.
3. Submit `account_security=false`, an unsupported language, an invalid
   timezone, a non-boolean value, and an unknown category. Each full-set update
   must fail without changing any stored preference.
4. Seed a formerly valid but currently unsupported timezone. Confirm it remains
   visible with a warning; changing only another preference preserves the exact
   stored timezone, while selecting a new invalid timezone is rejected.
5. Confirm no preference is sourced from localStorage, sessionStorage, Zustand,
   or another browser-only cache.

## Critical Walkthrough 4: Password Change

1. Sign A into sessions A1 and A2. Open `/profile/security` in A1.
2. Submit mismatched, 11-character, 129-character, common/compromised, and
   current-password-reuse values. Confirm server validation, no credential
   change, and no failed-current-password increment.
3. Confirm Unicode/spaces and exact 12/128-character boundary passwords are
   accepted without composition rules or older-password history.
4. Submit four incorrect current passwords across A1/A2. Confirm one shared
   account window with four timestamps.
5. Race incorrect attempts to reach five. Confirm one serialized 15-minute lock
   and a safe Retry-After; attempts remain locked across sessions.
6. Advance the controlled Clock past lock expiry. Submit the correct current
   password and valid different new password with one idempotency key.
7. Confirm Better Auth changes its credential, A1 remains authenticated, A2 is
   unusable within two seconds, the old password fails, and the new password
   works in a fresh login.
8. Confirm exactly one password-changed outbox row targets the effective email,
   one final audit event exists, and the attempt window is clear.
9. Inject failure after the credential write and during partial other-session
   revocation. Confirm no completed response while another session remains
   usable; retry the same idempotency key and submission until the operation
   converges and finalizes once.
10. Reuse the idempotency key with a different submission. Confirm `409` and no
    credential/session/email/audit duplication.
11. Keep an email change pending during password change. Confirm the password
    notification targets the currently effective address, not the pending one.
12. Scan database, logs, errors, audit, analytics, and capture metadata for
    current/new passwords, password confirmations, hashes, cookies, session
    tokens, raw IPs, request bodies, proofs, and full secret URLs. None may
    appear.

## Authorization and Anti-Forgery Matrix

For every GET and mutation:

- expire/revoke the session or mark the account ineligible while a form is
  open; the next operation must fail through Feature 001 without returning
  account data;
- inject `userId`, `accountId`, `profileId`, a foreign nested ID, or a
  client-chosen current session; strict validation or ownership policy must
  reject it;
- omit/alter `Origin`, Fetch Metadata, or `X-CSRF-Token` on protected writes;
  no data changes;
- perform a cross-site proof POST; same-origin validation rejects it;
- verify ordinary logs never record forwarding headers or raw network sources.

## Accessibility and Responsive Evidence

Test every Profile navigation destination and form at desktop width and 320 CSS
pixels:

- semantic headings/landmarks and directly addressable pages;
- programmatic labels and described instructions;
- keyboard-only add, remove, reorder, Save, and submit operations;
- focus moves to the error summary/first invalid field;
- Sonner toast is announced through an ARIA live region but never replaces
  persistent field/form guidance;
- stale-write warning and mandatory security-notification state do not rely on
  color;
- pending/busy controls expose status and prevent accidental duplicate submits;
- failed network requests retain entered form values;
- no horizontal overflow or inaccessible reorder-only drag interaction.

## Performance Evidence

Run against PostgreSQL 16.12 with:

- one account holding the maximum 50 skills, 50 experience entries, 50
  education entries, and 10 social links;
- representative shared-skill catalog size and pending/historical
  email-change data;
- five active Better Auth sessions;
- local capture email and the worker running;
- documented CPU, memory, browser/build, database latency, cold/warm state,
  sample size, and percentile.

Record at least 100 warm samples for each measured view or mutation class:

- p95 Profile/Account view load at or below 3 seconds;
- p95 profile, identity, and preference mutation response at or below 2
  seconds;
- wall-clock elapsed time from the completed password-change response until
  each of the four other sessions rejects authenticated use, with every
  measurement at or below 2 seconds.

External email delivery time is excluded because success means a durable
outbox enqueue, not provider delivery.

## Usability Evidence

Run a documented representative-user study for the four primary tasks:

1. complete and reorder professional-profile sections;
2. update account name and request/complete an email change;
3. change and verify preferences on another session/device;
4. change a password and understand the session/confirmation result.

Record participant/task counts, device/viewport, first-attempt completion,
assistance requested, time, accessibility accommodations, and observed
blockers. At least 90% of representative users must complete each task on the
first attempt without assistance before SC-003 is marked passed.
