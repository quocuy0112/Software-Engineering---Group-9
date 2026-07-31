# Research: Candidate Profile and Account Management

This research resolves the technical choices for Feature 002 against the
implemented Feature 001 baseline. There are no remaining `NEEDS CLARIFICATION`
items.

## Decision 1: Extend the existing modular Next.js application

**Decision**: Keep Feature 002 inside the existing `web/` npm workspace. Browser
interfaces use Next.js App Router pages and `web/src/app/api/**/route.ts` Route
Handlers. Route Handlers call services, services call repositories or
provider gateways, and Prisma is the only PostgreSQL data-access mechanism.
Better Auth 1.6.25 remains the exclusive browser-session and credential owner.

**Rationale**: This is the active architecture in
`spec-kit/specs/001-identity-authentication-account-recovery/plan.md` and in the
implemented repository. Reusing `requireSession`, `getWorkspaceContext`, the
CSRF proof, the audit sink, the outbox worker, and the Better Auth gateways
preserves one security model and one deployment unit.

**Alternatives considered**:

- A separate profile service or FastAPI backend was rejected because it would
  add a second backend mechanism and a distributed transaction boundary.
- A browser JWT or a second settings-session cookie was rejected because
  Better Auth already owns the sole opaque PostgreSQL-backed browser session.

## Decision 2: Model Profile as one aggregate with section saves

**Decision**: `CandidateProfile` is the aggregate root. A protected GET returns
the complete capped aggregate. A protected PATCH accepts one discriminated
section (`basics`, `skills`, `experience`, `education`, or `socialLinks`) plus
the aggregate `baseRevision`. Every section has an explicit Save action. Each
save locks the profile row, validates ownership for every supplied nested ID,
updates only that section in one transaction, increments the global revision,
and returns the complete current aggregate.

**Rationale**: This satisfies the clarified resource boundary: nested lists
remain part of Profile, while explicit section saves avoid one oversized form.
One aggregate revision also gives Feature 004 a stable concurrency boundary
when it later imports confirmed parsed CV data.

**Alternatives considered**:

- Independent public resources for experience, education, skills, and links
  were rejected because partial success could violate the aggregate contract.
- Per-field autosave was rejected by the specification.
- Replacing every child row on every save was rejected because stable child
  identities are needed for ownership checks and later Feature 004 merges.

## Decision 3: Apply last-write-wins under a row lock

**Decision**: The client submits the last revision it observed. Inside the
transaction, the repository locks the profile row and compares that revision
with the current value. A stale but otherwise valid save is still applied and
increments the current revision. The HTTP response is successful and carries
`conflictApplied: true` with the new revision; it is not a `409` response,
because the requested update was committed. The UI announces a warning toast
and retains a persistent status message.

**Rationale**: This implements the specified last-write-wins behavior without
silently overwriting another session. Serializing the check and update prevents
two concurrent writers from reporting the same resulting revision.

**Alternatives considered**:

- Rejecting stale writes with `409 Conflict` was rejected because the
  specification explicitly requires the later accepted write to win.
- Comparing revisions without locking was rejected because concurrent requests
  could both observe the same revision and lose conflict evidence.

## Decision 4: Use a normalized shared skill catalog

**Decision**: `Skill.normalizedName` is a unique NFKC-normalized, trimmed,
internal-whitespace-collapsed, locale-independent lowercase key. Diacritics are
preserved. `Skill.name` is a catalog display value, while
`CandidateProfileSkill.displayName` preserves the capitalization selected for
that profile. The join row also owns ordering. Saving skills performs a
concurrency-safe upsert by `normalizedName`; a protected suggestion query
returns at most 20 catalog matches and no account/profile data.

**Rationale**: A unique normalized key prevents case-only duplicates while the
join display value satisfies the requirement to preserve selected
capitalization. A real many-to-many relation remains useful for later
search/filtering and CV import.

**Alternatives considered**:

- A string array on Profile was rejected because it is not searchable,
  reusable, or relational.
- PostgreSQL `citext` was rejected because explicit normalization is already
  needed for whitespace and Unicode handling and avoids another database
  extension.
- Removing Vietnamese diacritics was rejected because this feature requires
  them to be preserved and does not require diacritic-insensitive skill
  matching.

## Decision 5: Sanitize to stored plain text at one server-only boundary

**Decision**: Pin `sanitize-html` 2.17.6 and
`@types/sanitize-html` 2.16.1 in the sole root lockfile. A server-only
`PlainTextNormalizer` uses an empty tag/attribute allowlist, discards non-text
content such as scripts/styles, decodes only the sanitizer's text escapes, and
then applies field-specific NFKC, whitespace, control-character, and length
rules. Values stored in PostgreSQL are plain text, not sanitized HTML. React
renders them only as text; profile code must not use `dangerouslySetInnerHTML`.
If normalization changes a submitted optional value, the response contains a
safe field warning; if a required nested value becomes empty, validation
fails.

**Rationale**: A maintained parser is safer than regular-expression HTML
stripping. The package recommends server-side sanitization and supports a
strict allowlist; it is pure JavaScript and compatible with the selected Node
runtime. The exact package information is recorded at
https://www.npmjs.com/package/sanitize-html and
https://www.npmjs.com/package/@types/sanitize-html.

**Alternatives considered**:

- Regex-only tag removal was rejected because malformed markup and entity
  handling are not safely parsed by regular expressions.
- DOMPurify plus a server DOM was rejected because this feature stores no rich
  HTML and does not need a DOM implementation.
- Preserving a rich-text subset was rejected because every specified field is
  plain text.

## Decision 6: Use deterministic built-in validators where they fit

**Decision**:

- Dates cross the API as `YYYY-MM-DD` and persist as PostgreSQL `date`
  (`DateTime @db.Date`) so timezone conversion cannot change a calendar day.
- Phone validation permits one leading `+`, digits, spaces, parentheses,
  periods, and hyphens, then requires 7–15 digits after separators are removed.
  It does not infer country, send SMS, or create an authentication factor.
- Social links use the WHATWG `URL` parser, allow only `http:` or `https:`,
  reject usernames/passwords, cap serialized length at 2,048, and use a
  canonical serialized URL for duplicate detection.
- Timezones are validated by constructing
  `Intl.DateTimeFormat("en-US", { timeZone })`; the submitted valid identifier
  is preserved. `Intl.supportedValuesOf("timeZone")` is not the validator
  because Node 24.18 accepts the required `Asia/Ho_Chi_Minh` identifier while
  listing its `Asia/Saigon` alias instead.

**Rationale**: These rules meet the feature's stated notion of plausibility and
validity without adding phone or timezone dependencies. Preserving the
submitted timezone also keeps the required default exact.

**Alternatives considered**:

- `libphonenumber` was rejected because the requirement needs plausible
  national/international presentation, not country inference or canonical
  telephony.
- Storing date-times at midnight was rejected because timezone conversions can
  shift dates.
- Using only `Intl.supportedValuesOf` was rejected after a Node 24.18 runtime
  check showed the alias mismatch above.

## Decision 7: Own email change as a SmartHire transaction workflow

**Decision**: Add a SmartHire-owned `EmailChangeRequest` rather than enabling
Better Auth's generic change-email flow. The request holds a unique HMAC digest
of a 32-byte random proof, proposed/normalized email, 30-minute expiry, status,
and idempotency/audit references. Creating a request:

1. validates the current Better Auth session and the existing recent-auth
   policy;
2. serializes the proposed normalized-email namespace;
3. expires stale reservations and rejects effective or active-reserved email;
4. supersedes the account's earlier pending request;
5. creates the request plus one verification outbox row to the proposed email,
   one security-notification row to the old email, and the required audit event
   in one PostgreSQL transaction.

A retry with the same authenticated account, idempotency key, and normalized
proposed email returns the existing accepted request without new proofs or
outbox rows. Reusing the key for another proposed email is an idempotency
conflict.

The effective `UserAccount.email` and `normalizedEmail` remain unchanged until
proof consumption. Verification locks the request and normalized-email
namespace, rechecks uniqueness, atomically updates the UserAccount, consumes
the request, and appends the outcome audit event.

**Rationale**: Better Auth 1.6.25's generic flow does not provide SmartHire's
cross-table pending-email reservation, supersession model, transactional
outbox, old-address notification, or audit contract. The UserAccount row is
already both Better Auth's user row and SmartHire's identity root, so updating
it transactionally does not introduce a second identity source.

**Alternatives considered**:

- Better Auth's built-in `changeEmail` callback was rejected because callback
  email delivery is outside the durable outbox transaction and does not reserve
  proposed addresses across requests.
- Changing the login email immediately and marking it unverified was rejected
  because the old email must remain authoritative until verification.

## Decision 8: Serialize cross-table email claims with advisory locks

**Decision**: Registration, email-change request, and email-change verification
must all acquire the same transaction-scoped PostgreSQL advisory lock using
`hashtextextended(normalizedEmail, fixedVersionedNamespaceSeed)` before
checking or changing claims. The fixed seed is stable across processes,
deployments, and secret rotation; a rare 64-bit collision only over-serializes
unrelated addresses. UserAccount keeps its existing unique normalized
effective email. Partial unique indexes enforce at most one `PENDING` request
per user and per proposed normalized email; code marks expired rows `EXPIRED`
while holding the claim lock before inserting.

**Rationale**: Effective emails and pending reservations live in different
tables, so no ordinary unique constraint can protect the union. A common
transaction lock plus table-level unique indexes makes the cross-table check
serializable without duplicating the authoritative identity in a claim table.

**Alternatives considered**:

- Check-then-insert without a lock was rejected because two accounts could both
  pass before either commits.
- A permanent email-claim table was rejected because it would duplicate every
  effective email and add drift/reconciliation risk.
- Database serializable isolation for every identity transaction was rejected
  as broader and more failure-prone than a narrow claim lock with bounded
  retries.

## Decision 9: Keep proof URLs out of HTTP requests and freeze recipients

**Decision**: The verification email links to
`/verify-email-change#proof=...`. Client code reads and immediately removes the
fragment, then POSTs the proof over a same-origin request; link navigation alone
does not mutate state. Only the HMAC digest is stored on
`EmailChangeRequest`. The outbox temporarily holds the proof sealed with the
existing AES-256-GCM token boundary.

Extend `EmailOutbox` with an optional purpose-separated AES-GCM protected
recipient snapshot. Email-change verification and old-address alerts use
snapshots because neither address is necessarily the user's effective email
when the worker eventually sends. Password-change confirmation also snapshots
the effective email at finalization. `recipientRef` remains a non-secret
logical reference; raw recipients, proofs, and complete URLs never enter
application/audit logs.

**Rationale**: URL fragments are not sent in the HTTP request or ordinary
server access logs. Frozen protected recipients make delayed delivery correct
without exposing additional plaintext addresses in outbox metadata.

**Alternatives considered**:

- Query-string proofs were rejected because complete secret-bearing URLs can
  appear in access logs, history, and referrers.
- Resolving every recipient from `UserAccount.email` at send time was rejected
  because it sends new-address verification to the old address and can send an
  old-address alert to the newly effective address.
- Storing plaintext recipient snapshots in `payloadRef` was rejected because a
  dedicated protected field is easier to validate and redact.

## Decision 10: Use a resumable Better Auth password-change operation

**Decision**: Better Auth continues to verify/hash/change credentials.
SmartHire adds a durable `PasswordChangeOperation` for cross-boundary
completion:

1. validate confirmation and the existing common/compromised password policy;
2. load an operation by authenticated account plus idempotency key and verify
   its keyed submission binding; a matching existing operation resumes before
   any new-attempt lock or reuse classification;
3. only for a new operation, check the failure window, use a Better Auth
   gateway to classify current-password validity and new-password reuse without
   exposing hashes, and persist the operation intent before provider mutation;
4. call a Better Auth-owned server gateway that re-verifies the current
   credential, hashes the policy-approved new Unicode password through
   `auth.$context.password`, and writes it through
   `internalAdapter.updatePassword`; this is the same provider boundary already
   used by Feature 001 reset and does not change the initiating session;
5. require the authoritative current session to match the operation's
   server-recorded initiating session, call Better Auth's
   `revokeOtherSessions`, then query PostgreSQL to prove no other usable
   session remains;
6. transactionally enqueue exactly one password-changed email to the current
   effective address, append the final audit event, clear the failed-attempt
   window, and finalize the operation.

Provider or persistence failure leaves an idempotent retryable milestone and
returns no completed success. A matching existing operation resumes only from
its server-recorded initiating session, even if a later unrelated failure
window is locked, because mandatory cleanup must converge without allowing a
different session to select itself as the survivor. After an ambiguous
credential result, the gateway checks whether the submitted new password
already matches the Better Auth credential; for that existing operation it is
evidence that the password milestone completed, not a reuse-validation
failure. No password or reusable password verifier is persisted.

**Rationale**: The implemented
`web/src/backend/auth/better-auth/better-auth-password-gateway.ts` already keeps
hashing and credential persistence behind Better Auth's context/internal
adapter. The pinned public `changePassword` route checks JavaScript UTF-16 code
units with `.length`, while SmartHire's approved PasswordPolicy counts Unicode
code points; using that route would incorrectly reject some valid 128-character
Unicode passwords. Better Auth's separate `revokeOtherSessions` API still
derives the retained session from the authoritative cookie. The two gateway
steps let SmartHire preserve Unicode policy, prove FR-043, and retry partial
session revocation without transferring credential/session ownership.

**Alternatives considered**:

- Direct Prisma password-hash writes were rejected because credential hashing
  and verification must stay behind Better Auth.
- Better Auth's public `changePassword` route was rejected for this workflow
  because its code-unit length check conflicts with the approved Unicode
  character rule; with `revokeOtherSessions: true` it also deletes every
  session and creates a replacement before SmartHire's audit/outbox milestones.
- Reporting success immediately after the credential write was rejected
  because other sessions and the required notification could remain incomplete.

## Decision 11: Track only incorrect current-password failures

**Decision**: Add one `PasswordChangeAttemptWindow` per account with a bounded
array of recent failure timestamps and nullable `lockedUntil`. An
account-scoped transaction lock filters timestamps older than 15 minutes and
appends only after Better Auth classifies the current password as incorrect.
The fifth retained timestamp sets `lockedUntil` to 15 minutes after that
failure. Policy, confirmation, length, compromised-password, and current-
password-reuse failures do not touch the window. Success clears it.

**Rationale**: The existing fixed-window `RateLimitBucket` increments when
consumed and therefore cannot precisely implement a rolling window that counts
only one failure class. The bounded timestamp list is small, exact, and easy to
test with a controlled clock.

**Alternatives considered**:

- Reusing the registration/login limiter was rejected because it would count
  validation errors and uses fixed windows.
- Browser counters were rejected because the limit must aggregate sessions and
  devices.
- Counting ordinary logs was rejected because logs are neither authoritative
  nor transactional.

## Decision 12: Keep resources and pages directly addressable

**Decision**: New browser API resources are rooted at `/api/account`:

- `/profile` GET/PATCH and `/profile/skills/suggestions` GET;
- `/identity` GET/PATCH;
- `/preferences` GET/PUT;
- `/email-change/request` POST and `/email-change/verify` POST;
- `/password/change` POST.

The protected Profile navigation becomes Professional (`/profile`), Account
(`/profile/account`), Preferences (`/profile/preferences`), Security
(`/profile/security`), and Sessions (`/profile/sessions`). Password change is a
separate form on the existing Security page. Email verification is the public,
no-store `/verify-email-change` page. Server Components call services directly
for initial reads; client forms call Route Handlers for mutations.

**Rationale**: The route map preserves the existing authenticated workspace and
directly separates professional data, account identity, preferences, and
security. It also keeps the externally visible resource boundary explicit.

**Alternatives considered**:

- One `/api/settings` object and one giant Profile page were rejected because
  they mix responsibilities and validation/failure boundaries.
- Calling internal HTTP endpoints from Server Components was rejected because
  it adds an unnecessary network hop inside the same application.

## Decision 13: Protect network-source audit evidence

**Decision**: A server-only `NetworkSourceProtector` accepts proxy headers only
under explicit `AUDIT_TRUSTED_PROXY_HOPS` configuration, validates the selected
address, reduces it to an IPv4 `/24` or IPv6 `/56` prefix, and stores only an
HMAC digest derived with the existing server secret under a separate context.
Production requires one or more configured trusted hops and fails sensitive
mutations closed when evidence is missing/invalid. Local/test value `0` accepts
only the direct loopback marker or an explicit controlled-test source; it is
never an allowed production configuration. Raw addresses and forwarding
headers never enter ordinary logs, errors, analytics, or audit context.

**Rationale**: Hashing an attacker-controlled leftmost forwarding value would
not be useful investigation evidence. Prefixing before a keyed digest reduces
precision while keeping equality useful to authorized investigators.

**Alternatives considered**:

- Persisting raw IP addresses was rejected by the privacy requirements.
- Hashing the full address without prefix reduction was rejected as
  unnecessarily precise.
- Trusting any `X-Forwarded-For` value was rejected because direct clients can
  spoof it unless a known proxy rewrites/appends the chain.

## Decision 14: Validate with layered, controlled-clock tests

**Decision**: Use existing Vitest/PostgreSQL integration, OpenAPI contract,
Testing Library accessibility, and Playwright desktop/mobile suites. Add
controlled-clock tests for revisions, dates, 30-minute email proofs, rolling
password failures, and operation retries. Concurrency tests use real
PostgreSQL transactions for profile writers, skill upserts, email claims, proof
consumption, and multi-session password changes. Performance evidence uses a
maximum-size profile (50 skills, 50 experiences, 50 education rows, 10 links)
and records p95 over 100 warm runs with capture email.

**Rationale**: SQLite/mocks cannot prove PostgreSQL row/advisory locks, partial
unique indexes, or concurrent session cleanup. Existing project scripts and
Compose PostgreSQL already supply the required environment.

**Alternatives considered**:

- Unit tests alone were rejected because the highest-risk requirements are
  transactional and concurrent.
- Network email in routine acceptance was rejected because delivery is
  asynchronous and the capture adapter provides deterministic evidence.
