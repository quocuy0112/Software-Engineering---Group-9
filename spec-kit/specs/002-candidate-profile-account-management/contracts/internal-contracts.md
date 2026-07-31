# Internal Integration Contracts

These are in-process boundaries in the existing Next.js application. They do
not create separate services or authorize direct browser calls. Browser-facing
contracts are defined in `openapi.yaml`.

## AuthenticatedAccountContext

`requireSession(headers, now)` remains the only entry to protected Feature 002
behavior. It validates the Better Auth cookie and Feature 001 account-state,
idle, absolute-expiry, recovery, and revocation policy. The resulting context
contains only server-derived `userId` and `sessionId`. Route Handlers must
reject strict input schemas containing ownership identifiers.

Protected mutations additionally validate:

- the configured same origin and Fetch Metadata;
- the existing session-derived `X-CSRF-Token`;
- ACTIVE account state immediately before persistence;
- a privacy-protected network-source digest for audited security mutations.

## ProfileAggregateService

### Read

Input: authenticated `userId`.

Output: one complete capped Profile aggregate with global revision, basics,
skills, experience, education, and social links. A profile with no meaningful
content returns `empty: true`, empty arrays, nullable basics, and a valid
revision.

### Save section

Input:

- authenticated `userId`;
- `baseRevision`;
- exactly one strict, validated section payload;
- injected `Clock`.

Output:

- the complete post-commit aggregate;
- `conflictApplied`, true when `baseRevision` was stale;
- safe field normalization warnings;
- a stable accessible message.

The service performs all normalization before repository writes. It must not
retry a validation/ownership error as a persistence conflict.

## ProfileAggregateRepository

`saveSection` starts one PostgreSQL transaction, locks the caller's profile,
verifies supplied owned-child/association IDs, mutates only the selected
section, and increments the revision once. A shared catalog Skill ID must match
the normalized submitted label but is not treated as another profile's owned
data. The repository accepts no arbitrary Prisma client from transport code.
Skill upsert is scoped inside the transaction and resolves a unique-key race by
loading the winning catalog row.

The repository returns whether the submitted revision differed from the locked
revision. It never throws a response containing a foreign profile/child ID.

## PlainTextNormalizer

Server-only boundary around the exact pinned sanitizer. It accepts:

- raw string;
- field kind and length;
- whether empty is allowed;
- whether internal whitespace should collapse.

It returns normalized plain text plus a `changed` flag, or a field-safe
validation error. It never returns HTML. Script/style contents and control
characters do not survive. Vietnamese diacritics remain. Client components
receive plain strings and render them as React text.

## SkillCatalog

`normalizeSkillName` produces the deterministic unique key described in
`data-model.md`. `suggest(query, limit)` requires an authenticated user, a
normalized 1–80-character query, and a maximum limit of 20. It returns only
skill IDs and display names, never profile associations, account IDs, usage
counts, or recruiter data.

## EmailAddressClaimCoordinator

Every effective-email or pending-email writer calls this repository helper
inside its Prisma transaction. It invokes
`pg_advisory_xact_lock(hashtextextended(normalizedEmail,
fixedVersionedNamespaceSeed))`. The fixed seed is process/secret-rotation
independent; hash collisions only serialize extra work. Once held, callers
expire stale pending reservations and query both:

- `UserAccount.normalizedEmail`;
- `EmailChangeRequest.normalizedProposedEmail` in `PENDING`.

Registration, email-change request, and proof consumption must share this
helper. A path that changes an effective/pending email without it is an
architecture-test failure.

## EmailChangeService

### Request

Input: authenticated context, `currentPassword`, normalized proposed email,
idempotency key, correlation ID, protected network source, and Clock.

Behavior:

1. invoke the existing recent-auth service;
2. generate one random proof through `TokenProtector`;
3. commit request, supersession, protected recipient snapshots, two outbox
   rows, and accepted audit atomically;
4. return queued metadata without proof, token digest, outbox payload, or
   account-existence details.

A matching account/idempotency key/proposed normalized email returns the
existing accepted result and never regenerates proof or delivery jobs. The same
key bound to a different proposed email is rejected.

### Verify

Input: one-time proof, same-origin request evidence, correlation ID, protected
network source, and Clock. No current-session user ID selects the target.

Behavior: digest the proof, conditionally consume the bound latest request,
atomically update its UserAccount, and append the outcome audit. A session for
another account cannot redirect the proof. Every invalid/expired/superseded/
used/conflicted proof maps to a safe error without echoing proof or email.

## ProtectedOutboxRecipient

A purpose-separated AES-256-GCM boundary using server-only key material. It
seals a validated mailbox for a specific email intent and unseals only in the
outbox worker immediately before adapter delivery. Ciphertext is authenticated
with its purpose/version to prevent cross-intent substitution.

Callers never pass provider credentials. Adapters receive the decrypted
recipient in protected process memory and return only provider message IDs or
allowlisted errors.

## BetterAuthPasswordChangeGateway

The gateway wraps only pinned Better Auth 1.6.25 server behavior:

- `classify(userId, currentPassword, newPassword)` returns booleans for
  current-password validity and new-password reuse; it never returns a hash;
- `changeVerifiedPassword(userId, currentPassword, newPassword)` re-verifies
  immediately, hashes through `auth.$context.password`, and persists through
  Better Auth's `internalAdapter.updatePassword`; it deliberately does not use
  the pinned public route's UTF-16 `.length` guard after SmartHire has validated
  Unicode code points;
- `newPasswordIsEffective(userId, newPassword)` converges an ambiguous write;
- `revokeOtherSessions(headers, expectedInitiatingSessionId)` derives the
  retained session from Better Auth's authoritative cookie and fails unless
  its server ID matches the operation's server-recorded initiating session;
- no method accepts a client-supplied session ID or token.

Provider errors are mapped to allowlisted internal failure codes. Raw passwords
and provider error bodies are never logged, audited, returned, or persisted.

## PasswordChangeAttemptPolicy

Input: authenticated `userId` and Clock.

- `checkLock` returns either allowed or safe retry metadata.
- `recordIncorrectCurrentPassword` serializes the per-account row, prunes
  timestamps outside 15 minutes, appends one failure, and sets the 15-minute
  lock on the fifth.
- `clearAfterSuccess` clears failure state in the finalization transaction.

Proposed-password validation and reuse do not call the record method.

## PasswordChangeOperationService

Input: authenticated context, current/new/confirmation values, opaque
idempotency key, correlation ID, protected network source, and Clock.

The service validates the proposed fields, then looks up the authenticated
user plus idempotency key. A matching existing operation must have the same
submission binding and the authoritative current session must match its
server-recorded initiating session; it then resumes before applying new-attempt
lock/reuse rules. Only a new operation checks the attempt lock, classifies
current validity and reuse, and persists its intent before provider mutation.
It returns completed only after:

1. Better Auth credential change is known effective;
2. Better Auth other-session revocation succeeds;
3. a repository query confirms no other usable session remains;
4. one password-changed outbox row and final audit event are durable;
5. the attempt window is clear and the operation is final.

For an existing operation, `newPasswordIsEffective=true` converges an
ambiguous password write rather than triggering the new-operation reuse error.
The existing operation may finish mandatory cleanup despite a later unrelated
attempt lock. The same idempotency key with a different keyed submission
binding is rejected. `FAILED_RETRYABLE` returns a generic `503` and does not
claim completion.

## NetworkSourceProtector

Input: request headers and configured trusted proxy hops.

Output: keyed digest of a validated IPv4 `/24` or IPv6 `/56` prefix, never the
raw address. In production, missing/invalid trusted network evidence is a
fail-closed security-action error. It must not log forwarding headers or
include them in thrown errors.

## AccountPreferencesService

Read returns stored values or the exact virtual defaults:

- `vi`;
- `Asia/Ho_Chi_Minh`;
- all three email categories true.

Update accepts one complete strict set. `account_security=false` is invalid.
The service validates a changed timezone through `Intl.DateTimeFormat`; it may
preserve an exact previously stored timezone that is no longer supported so an
unrelated setting can change without silent data loss.

## Clock

All date comparisons, 30-minute email proofs, 15-minute password windows,
revision tests, operation retry timestamps, and audit timestamps use an
injectable UTC Clock. Route Handlers use the system implementation; tests use a
controlled implementation.

## Error and Logging Contract

Client errors contain only allowlisted codes, user-safe messages, field paths,
and optional retry seconds. They never contain:

- raw/sanitized request bodies;
- profile values belonging to another user;
- passwords or password-derived operation bindings;
- cookies, session IDs/tokens, CSRF proofs;
- email-change proofs/digests or full links;
- recipient ciphertext/plaintext;
- raw IP/proxy headers;
- raw Prisma, Better Auth, SMTP, Resend, or sanitizer errors.
