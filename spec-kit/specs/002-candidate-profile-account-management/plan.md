# Implementation Plan: Candidate Profile and Account Management

**Branch**: `002-candidate-profile-account-management` | **Date**: 2026-07-31
**Spec**: `spec-kit/specs/002-candidate-profile-account-management/spec.md`

## Summary

Deliver Feature 002 inside the existing modular full-stack Next.js application.
Authenticated users maintain one structured CandidateProfile aggregate,
separate Account Identity and Account Preferences resources, a verified
email-change workflow, and a secure password-change workflow. All ownership is
derived from Feature 001's server-validated Better Auth session; no browser
credential, account identity, session table, email worker, or audit mechanism
is duplicated.

Profile sections save explicitly and transactionally, share one revision, and
apply valid stale writes under visible last-write-wins. Email changes use a
SmartHire-owned 30-minute pending reservation with one-time HMAC proof,
cross-table normalized-email locking, and the existing transactional outbox.
Password changes use Better Auth for verification/hashing, preserve the
initiating session, durably resume partial work, and return success only after
every other session is proven unusable and the confirmation email/audit event
are committed.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`; root `.nvmrc` and
`.node-version` select the same Node line

**Primary Dependencies**: Next.js `16.2.11`, React `19.2.3`, Better Auth and
`@better-auth/prisma-adapter` `1.6.25`, Prisma/client/PG adapter `7.9.0`, Zod
`4.3.6`, React Hook Form `7.82.0`, Sonner `2.0.7`, Tailwind CSS `4.1.18`,
shadcn/ui conventions, React Email/Resend/Nodemailer through the existing
outbox boundary; add exact server-only `sanitize-html` `2.17.6` and
`@types/sanitize-html` `2.16.1`

**Storage**: PostgreSQL `16.12` through root Docker Compose on host port
`55432`; Prisma ORM and Prisma Migrate from `web/`; no other production
database, browser persistence, or file store

**Testing**: Vitest `4.1.10`, Testing Library, OpenAPI 3.1 contract tests, real
PostgreSQL integration/concurrency tests, Playwright `1.57.0` desktop and
320-pixel mobile E2E, controlled Clock, production build, and measured p95
evidence

**Target Platform**: Node.js server runtime in the existing Next.js deployment
unit and supported modern desktop/mobile browsers; local validation on
Windows/macOS/Linux with Docker Compose

**Project Type**: Modular full-stack web application in one npm workspace

**Performance Goals**: Over at least 100 warm samples per measured interaction
class, p95 Profile/Account page load with the maximum Profile aggregate at or
below 3 seconds and p95 profile, identity, and preference saves at or below 2
seconds; measured wall-clock time from a completed password-change response
until every other session is unusable at or below 2 seconds; asynchronous
provider delivery excluded

**Constraints**: one Better Auth opaque browser session; ACTIVE account and
server-side ownership on every operation; strict CSRF/same-origin checks; no
raw secrets/IPs in logs or audit; no partial Profile aggregate writes; 50
skills, 50 experiences, 50 education rows, and 10 social links returned without
pagination; one 30-minute latest email-change proof; exact rolling
five-failure/15-minute password lock; no profile completeness gate, CV
upload/parser, public profile, avatar, SMS, AI, or new recruitment preferences

**Scale/Scope**: four user stories, five directly addressable protected Profile
destinations, one public verification page, ten browser API operations, ten
new domain/support models including the profile children, and extensions to
UserAccount, CandidateIdentity, EmailOutbox, AuditEvent allowlists, and
registration's email-claim transaction

## Dependency Decision

Pin `sanitize-html` `2.17.6` and `@types/sanitize-html` `2.16.1` through the
sole root lockfile. Only
`web/src/backend/security/plain-text/plain-text-normalizer.ts` may import the
runtime package. Its policy allows no elements or attributes, discards
non-text script/style content, and returns normalized plain text. Profile and
identity renderers use normal React text nodes and never
`dangerouslySetInnerHTML`.

Implementation cannot begin past the dependency gate until the exact pair
passes Node `24.18.x`/TypeScript `5.9.3` typecheck, server-only import checks,
malformed-XSS corpus tests, production build, root-lockfile resolution, and
`npm audit --json` without an unreviewed critical/high finding. The package is
replaceable behind `PlainTextNormalizer`.

Task T005 is the blocking pre-implementation dependency gate. It runs after the
dependency pin and compatibility-test authoring tasks and must pass before T006
or any schema/application implementation beginning at T011. Later dependency
and build tasks re-run this evidence as release regression checks; they are not
the first execution of the gate.

All other validation uses current project/runtime capabilities:

- WHATWG `URL` for `http`/`https` social links;
- PostgreSQL `date` plus a Clock for calendar rules;
- `Intl.DateTimeFormat` for IANA timezone acceptance while preserving the
  required `Asia/Ho_Chi_Minh` value;
- the existing PasswordPolicy for 12–128 characters and local
  common/compromised screening;
- purpose-separated Node crypto through existing server-only protection
  boundaries.

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle / gate | Design evidence | Result |
|---|---|---|
| I Human-controlled recruitment | Feature contains no AI, score, recommendation, or recruitment decision. | Pass / N/A |
| II Security, privacy, tenant isolation | Better Auth session is authoritative; account identity is session-derived; strict schemas/ownership/CSRF; plain-text sanitization; proof fragments/digests; protected recipient and network-source values; self-service data never crosses accounts. Company tenancy is not in this feature. | Pass |
| III Deterministic core / explainable AI | All behavior is deterministic and AI-free. No AI provider or fallback is selected because AI is outside scope. | Pass / N/A |
| IV State, audit, integrity | Profile row locks and transactions; stable child FKs; skill/email uniqueness; email proof conditional consumption; outbox idempotency; resumable password operation; required allowlisted audit. | Pass |
| V Scope / complete P0 | Completes the approved P0 professional profile and related self-account workflows; CV parsing, recruiter/public viewing, avatar, deletion, SMS, and completeness gates remain excluded. | Pass |
| VI Quality / accessibility | Required 3s/2s targets; controlled environment; keyboard/ARIA/focus/persistent feedback; 320px tests; stale-write warning; real PostgreSQL concurrency evidence. | Pass |
| VII Maintainable provider-independent architecture | One Next.js Route Handler mechanism; Route Handler -> Service -> Repository/Gateway -> PostgreSQL; one Better Auth session/credential owner; replaceable sanitizer/email boundaries; typed Zod/OpenAPI contracts. | Pass |

No waiver or complexity exception is required.

## Architecture and Layer Boundaries

```text
Browser
  |
  +-- (workspace) Server Components -> Profile/Account services for initial read
  |
  +-- /api/account/**/route.ts
          |
          v
      typed service layer
          |
          +-- Profile / Account repositories -> Prisma -> PostgreSQL
          +-- Better Auth password/session gateways -> Better Auth -> PostgreSQL
          +-- Audit sink -> Prisma -> PostgreSQL
          +-- EmailOutbox -> due worker -> EmailService -> capture | SMTP | Resend
```

- `web/src/app/` contains route files, layouts, redirects, metadata, and server
  composition only. Route Handlers perform HTTP translation and trust-boundary
  validation; they contain no domain policy or direct Prisma calls.
- `web/src/backend/services/` owns ownership, aggregate/concurrency rules,
  email/password state machines, and preference policy.
- `web/src/backend/repositories/` owns Prisma queries, row/advisory locks,
  transactions, and unique-conflict mapping.
- `web/src/backend/auth/` keeps Better Auth credential/session operations behind
  minimal server-only gateways.
- `web/src/shared/contracts/account/` is the transport-neutral Zod source
  aligned with `contracts/openapi.yaml`.
- `web/src/frontend/features/profile/` owns React Hook Form state and
  presentation. Form values remain in memory after a failed request but are not
  copied to localStorage, sessionStorage, Zustand, or persistent query caches.
- Sonner supplements a persistent status/error summary. It is never the sole
  result channel.

## Resource and Page Design

### Browser API

| Resource/action | Method/path | Boundary |
|---|---|---|
| Profile | `GET /api/account/profile` | Complete owned aggregate |
| Profile section | `PATCH /api/account/profile` | One discriminated section plus `baseRevision` |
| Skill suggestions | `GET /api/account/profile/skills/suggestions` | Catalog-only, maximum 20 |
| Account Identity | `GET/PATCH /api/account/identity` | Name and effective/read-only account data |
| Account Preferences | `GET/PUT /api/account/preferences` | Complete validated preference set |
| Request email change | `POST /api/account/email-change/request` | Recent auth, reservation, two outbox rows |
| Verify email change | `POST /api/account/email-change/verify` | Same-origin one-time proof consumption |
| Change password | `POST /api/account/password/change` | Idempotent resumable security action |

Every protected mutation requires Better Auth's cookie, the existing
session-derived CSRF proof, exact origin, and Fetch Metadata. The public proof
endpoint requires exact same-origin/Fetch Metadata and accepts no ownership
identifier. Successful responses for the nine sensitive operations are
no-store: Profile GET/PATCH, Account Identity GET/PATCH, Account Preferences
GET/PUT, email-change request/verification, and password change. Authenticated
skill suggestions return catalog-only data and are the sole operation outside
this sensitive-response set. OpenAPI uses one reusable `NoStoreHeader`
definition for the nine operations.

### App Router pages

- `/profile`: Professional profile and valid empty state.
- `/profile/account`: Account name, effective email, safe metadata, and pending
  email-change state.
- `/profile/preferences`: Language, timezone, and notification controls.
- `/profile/security`: New password-change form plus existing Better Auth
  TOTP/recovery controls.
- `/profile/sessions`: Existing session management, unchanged.
- `/verify-email-change`: Public no-store fragment reader and explicit
  verification action.

`ProfileNavigation` never emits an `href` to an unimplemented route.
Professional, Security, and Sessions remain available from the foundation;
Account and Preferences are added atomically by the story task that ships each
corresponding page. The two small shared-navigation integrations are serialized
when story lanes run concurrently. WorkspaceShell is not duplicated, and the
(workspace) layout still validates one request-memoized session. A page may
call a service directly for initial data; it must not call its own HTTP API.

## Profile Aggregate Design

The migration creates one empty CandidateProfile for every existing
CandidateIdentity and adds profile creation to registration. The aggregate owns
nullable headline, summary, phone, and location plus stable ordered child rows:

- ProfileExperience;
- ProfileEducation;
- CandidateProfileSkill -> shared Skill;
- SocialLink.

Each Save validates the entire selected section in memory, locks the profile
row, checks every supplied owned child/association ID belongs to that row, and
commits all create/update/delete/reorder effects plus one revision increment.
A foreign and nonexistent owned ID have the same safe failure. Shared catalog
Skill IDs must agree with their normalized submitted label; catalog rows are
upserted by a unique normalized key under the same transaction.

If `baseRevision` is stale, the service still applies the valid section to the
latest aggregate, returns `conflictApplied: true`, and the UI announces both a
warning toast and persistent warning. It does not use HTTP `409` because the
write committed. The profile page never calculates completeness or blocks
another workflow.

### Validation

- All free text crosses the one server-only PlainTextNormalizer. NFKC and
  field-specific whitespace handling preserve Vietnamese diacritics.
- Required nested values that sanitize to empty fail before persistence;
  optional values become null with a safe normalization warning.
- Phone accepts only a plausible 7–15-digit national/international display
  format and has no authentication/SMS meaning.
- Calendar values use ISO date and PostgreSQL `date`. Experience current/end
  and education expected-completion rules are enforced by service plus stable
  database invariants.
- Social links are complete `http`/`https` URLs, have no embedded credentials,
  and are unique by canonical serialization.
- Skill matching is case-insensitive through a normalized key; a join-level
  display name preserves selected capitalization.

## Account Identity and Email-Change Design

`UserAccount` remains Account Identity. `name` accepts 1–150 sanitized
non-whitespace characters. Account creation/status/verification data is
read-only, and professional fields are not part of the identity mutation.

Email change is intentionally not delegated to Better Auth's generic callback:

```text
recent-authenticated request
  -> lock normalized proposed-email namespace
  -> reserve EmailChangeRequest for 30 minutes
  -> supersede older request for this account
  -> commit verification(new) + security alert(old) + audit
  -> worker delivers asynchronously

/verify-email-change#proof=...
  -> remove fragment locally
  -> explicit same-origin POST
  -> lock request/account/proposed-email namespace
  -> recheck uniqueness
  -> UserAccount email update + request consume + audit in one transaction
```

The request holds only a token digest; outbox payload holds the proof sealed
until worker delivery. Verification links put proof in the URL fragment so GET
navigation/access logs do not receive it. A signed-in different account cannot
redirect the proof because the proof-bound request selects the target.
Same-account retries with the same Idempotency-Key and normalized email return
the existing accepted request without creating another proof or email; binding
that key to a different email is rejected.

UserAccount's unique effective normalized email and partial unique pending
reservations cannot express a union constraint. Registration, email request,
and confirmation therefore share one transaction-scoped PostgreSQL advisory-
lock helper for the normalized email, expire stale reservations under that
lock, and then check both tables. This is the only approved email-claim path.

The existing outbox is extended with an authenticated-encrypted recipient
snapshot. Verification must target the proposed email and the alert must target
the old email even if the effective account email changes before delivery.
Outbox creation, not provider delivery, is the request transaction boundary.

## Preferences Design

`AccountPreferences` is a one-to-one optional UserAccount row. Absence returns
virtual defaults without a write:

- `vi`;
- `Asia/Ho_Chi_Minh`;
- application updates, job recommendations, and account security enabled.

PUT replaces the complete set atomically. Strict schemas reject unknown
categories/non-booleans; both application code and a database CHECK prevent
`account_security=false`. A newly chosen timezone must be accepted by
`Intl.DateTimeFormat`. If a formerly valid stored timezone becomes unsupported,
the read includes `timezoneSupported: false`, and the exact unchanged value may
survive an unrelated preference update until the user chooses another valid
zone.

## Password-Change Design

The existing PasswordPolicy remains authoritative for 12–128 characters,
Unicode/spaces, no composition rules, and common/compromised screening. Feature
002 adds only "different from current"; no older history is stored.

### Failure window

One server-side PasswordChangeAttemptWindow keeps at most five timestamps in
the rolling prior 15 minutes. An account lock serializes concurrent updates.
Only Better Auth's classification that the current password is wrong appends.
New-password policy, confirmation, and current-password-reuse errors do not.
The fifth wrong check locks the account for 15 minutes; success clears state.

### Durable operation

The PasswordChangeOperation is an orchestration record, not a credential:

1. validate proposed password and load by authenticated account plus opaque
   `Idempotency-Key`;
2. if a matching operation exists, verify its keyed non-reusable submission
   binding and require the authoritative current session to equal the
   server-recorded initiating session before resuming;
3. only for a new operation, check the failure window, have Better Auth
   classify current validity/reuse, and persist the operation intent;
4. use the Better Auth password gateway to re-verify, hash, and persist the
   policy-approved Unicode password without changing the initiating session;
5. call Better Auth `revokeOtherSessions` only after its cookie-derived session
   matches the operation's server-recorded initiating session;
6. query PostgreSQL and require zero other usable sessions;
7. transactionally snapshot the current effective email, create the one
   `PASSWORD_CHANGED` outbox row, append final audit, clear failures, and
   finalize.

If any milestone fails, return generic `503` and leave a retryable operation.
If the credential write result was ambiguous, Better Auth verifies whether the
same submitted new password is already effective and resumes; for the existing
operation this is completion evidence, not a new reuse error. Existing
operations may finish mandatory cleanup despite a later unrelated attempt
lock. No raw password, Better Auth hash, cookie, token, or client-selected
session ID is stored. A completed response is impossible while a required
other session remains usable.

## Security, Privacy, and Audit

- Extend AuditEvent's Zod allowlist, not its table ownership. Accepted/rejected
  email requests, verification outcomes, password outcomes, and password-lock
  events are required durable events.
- `NetworkSourceProtector` trusts forwarding headers only with explicit
  trusted-proxy-hop configuration, reduces a valid address to IPv4 `/24` or
  IPv6 `/56`, and stores a purpose-separated HMAC digest. Raw IP/header values
  never enter ordinary logs or audit context.
- Strict request schemas reject extra properties. Route Handler body limits are
  bounded for aggregate sections and small account/security actions.
- CSP, `Referrer-Policy: no-referrer`, no-store headers, output encoding, and
  same-origin validation remain enabled. Add `/verify-email-change` to the
  security-page no-store header set.
- Profile, identity, preferences, email requests, and operations follow the
  existing soft-deletion, retention, least-privilege, and Vietnamese
  personal-data policy. Feature 002 creates no public/recruiter profile view.
- Logs/errors/analytics exclude profile request bodies, names/emails, passwords,
  proofs, full links, recipient values, cookies, sessions, CSRF values, raw
  network sources, and raw provider/database errors.

## Environment Configuration

| Variable | Purpose |
|---|---|
| `AUDIT_TRUSTED_PROXY_HOPS` | Number of trusted reverse-proxy hops used to select current request network evidence. Production requires at least one; local/test `0` permits only the direct loopback marker or controlled fixtures. |
| `TOKEN_SECRET` | Existing server secret; derive separate versioned contexts for one-time proof HMAC/sealing, protected outbox recipients, idempotent submission binding, and audit IP-prefix HMAC. It is not used for database advisory-lock identity. |
| `EMAIL_ADAPTER`, existing capture/SMTP/Resend variables | Unchanged provider-independent outbox delivery. Capture remains the local default. |
| `DATABASE_URL`, `DIRECT_URL`, Better Auth/session variables | Unchanged Feature 001 database and exclusive session/credential configuration. |

Update root/web example environments, local setup generation, and environment
validation without printing secrets or network evidence. No Feature 002
variable may have a `NEXT_PUBLIC_` prefix, and no new browser-session/JWT
variable exists.

## Database Migration Strategy

Use a new reviewed forward migration; never edit applied Feature 001 SQL.

1. Add enum values, new tables, and nullable protected-recipient outbox fields.
2. Backfill one empty CandidateProfile for each CandidateIdentity and verify
   one-to-one counts.
3. Add/enforce FKs, ordering uniques, normalized skill unique, pending-email
   partial uniques, account-security CHECK, and invariant checks.
4. Update registration to create CandidateProfile and acquire the common
   email-claim lock before accepting a normalized email.
5. Regenerate the Prisma client and compare the Better Auth-owned model fields
   against pinned 1.6.25 compatibility evidence; none may be duplicated or
   renamed.
6. Run `db:verify` from empty and Feature 001-upgraded databases, inspect drift,
   and retain backup/forward-fix recovery instructions.

Hard deletion remains outside scope. CandidateProfile-owned rows cascade only
under the future approved account-retention process; shared Skills and durable
audit/outbox records do not disappear because one association is removed.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/002-candidate-profile-account-management/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- openapi.yaml
|   `-- internal-contracts.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|-- src/
|   |-- app/
|   |   |-- (auth)/
|   |   |   `-- verify-email-change/page.tsx
|   |   |-- (workspace)/profile/
|   |   |   |-- page.tsx
|   |   |   |-- account/page.tsx
|   |   |   |-- preferences/page.tsx
|   |   |   |-- security/page.tsx
|   |   |   `-- sessions/page.tsx
|   |   `-- api/account/
|   |       |-- profile/route.ts
|   |       |-- profile/skills/suggestions/route.ts
|   |       |-- identity/route.ts
|   |       |-- preferences/route.ts
|   |       |-- email-change/{request,verify}/route.ts
|   |       `-- password/change/route.ts
|   |-- backend/
|   |   |-- auth/better-auth/
|   |   |-- security/{plain-text,network-source,protected-recipient}/
|   |   |-- services/{account,profile}/
|   |   |-- repositories/{account,profile}/
|   |   |-- audit/
|   |   `-- email/
|   |-- frontend/features/profile/
|   |   |-- client/
|   |   `-- components/
|   `-- shared/contracts/account/
`-- tests/
    |-- architecture/
    |-- backend/{unit,contract,integration}/
    |-- frontend/{unit,accessibility}/
    `-- system/e2e/profile-account/
```

**Structure Decision**: Extend the existing `web/` modular application. Keep
thin App Router boundaries, server business logic/repositories under
`backend/`, stateful presentation under `frontend/features/profile/`, shared
strict contracts under `shared/`, Prisma migrations under `web/prisma/`, and
all tests under `web/tests/`.

## Verification Strategy

- **Architecture**: forbid direct Prisma in Route Handlers/client code,
  server-only sanitizer/crypto/provider imports, second session/JWT/cookie, and
  internal HTTP from Server Components.
- **Contract**: validate OpenAPI and Zod parity, strict unknown-property
  rejection, no client ownership IDs, no secret-bearing responses, explicit
  `conflictApplied`, immutable account-security preference, and retry headers.
- **Unit**: text normalization/XSS corpus, Unicode length, skill/email/URL
  normalization, phone/date rules, timezone alias behavior, password policy and
  failure-window clock edges, network prefix/HMAC extraction, protected
  recipient roundtrip/redaction.
- **PostgreSQL integration**: aggregate rollback/ownership/order, stale writers,
  concurrent skill upserts, cross-table email-claim races, token
  expiry/supersession/single-use, outbox idempotency/snapshots, password failure
  concurrency, ambiguous password milestones, partial session revocation and
  finalization.
- **Authorization**: at least two accounts; forged user/profile/child/session
  identifiers, inactive/expired session, CSRF/origin failure, and proof opened
  under the wrong signed-in account.
- **Component/accessibility**: valid empty/loading/error states, explicit Save,
  keyboard add/remove/reorder, labels, focus/error summaries, ARIA live toast
  plus persistent messages, stale-write warning, mandatory security setting,
  reduced motion, and 320px overflow.
- **Usability**: a documented representative-user study covers the primary
  professional-profile, account-identity/email, preference, and password tasks;
  at least 90% complete each on the first attempt without assistance, with
  environment, participant/task counts, and observed blockers recorded.
- **E2E**: all four user stories with real Better Auth sessions/PostgreSQL and
  capture email, including old/new email login behavior and current/other
  session behavior.
- **Security/privacy**: stored-XSS execution tests, unsafe URLs, secret/log scans,
  raw-IP absence, proof fragment/no-referrer behavior, sanitizer dependency
  audit, and no browser persistence.
- **Performance**: record environment/dataset/build/sample/p95 for maximum
  Profile aggregate; page <=3s, save <=2s, completed other-session revocation
  <=2s.

Detailed commands, fixtures, walkthroughs, and expected outcomes are in
`quickstart.md`.

## Post-Design Constitution Re-check

All gates still pass after research, data modeling, and contract design.
Feature 002 has one browser-session/credential owner, one production database,
one backend routing mechanism, explicit provider/sanitizer boundaries,
transactional Profile and identity writes, durable security audit/outbox
behavior, measurable accessible outcomes, and no AI or recruitment decision.
No scope exclusion or constitutional requirement requires a waiver.
