# Internal Service Contracts

These boundaries are server-only TypeScript interfaces. Route Handlers parse
transport input and call services; they never import repositories/providers
directly. Providers never decide authorization or business state.

## AdminRequestBoundary

Input: request headers, expected exact origin/host, command/read classification,
step-up requirement, current time.

Output on success:

```text
AdminActor {
  userId
  grantId
  sessionId            # server-only
  designationVersion
  lastTwoFactorProofAt
  csrfBinding           # server-only
}
```

Checks ACTIVE UserAccount, ACTIVE/unexpired PlatformAdministratorGrant, current
unrevoked Better Auth Session, exact designated Session, initial factor proof,
exact host/origin, same-origin/Fetch Metadata, and CSRF for commands. It returns
no actor on denial and records allowlisted denied high-risk audit when required.

## AdministratorSessionService

- `completeInitialTwoFactor(userId, sessionId, proof)` — transactionally lock
  grant/policy; validate proof/account/grant/session; revoke prior designated
  Session when different; designate current Session; record proof time/audit.
- `stepUp(actor, proof)` — validate same current designation and update proof
  time only.
- `assertFresh(actor, maxAge=15m)` — no mutation; stable STEP_UP_REQUIRED.

No method mints a browser credential.

## AdminAccountService

- `listAccounts(actor, query)` — exact FR-014 projection/order.
- `getAccountSecurity(actor, accountId)` — exact FR-015/session allowlist.
- `revokeSession`, `revokeAllSessions`, `suspend`, `reinstate` — reason,
  rationale, version, idempotency; atomic state/audit/rationale/notification.

Service enforces self/last-usable-admin, current state, session ownership,
idempotency, and version conflicts.

## DashboardDefinition and SnapshotService

`DashboardDefinition` is a versioned pure server module containing metric keys,
units, membership/account/request/report state predicates, and canonical list
filters. Snapshot generation and live list repositories must import this module.

The account, company-reference, company-membership, verification-request, and
moderation-report list contracts always return their current `calculatedAt` and
the same required `stateDefinitionVersion`. Missing or mismatched versions fail
contract validation rather than falling back to client definitions.

`SnapshotService.current()` returns an unexpired snapshot age ≤60 seconds or
SNAPSHOT_UNAVAILABLE. Worker recomputes every 30 seconds and can accept an
immediate recalculation request without letting callers block on it.

## CompanyRelationshipPrerequisiteGateway

- `inspect(request, actor)` — safe validity/scope projection for admin review.
- `lockAndValidate(request, transaction, now)` — exact applicant/company/role,
  AVAILABLE, unexpired/unrevoked/unused, plus active OWNER for OWNER_APPROVAL.
- `consume(prerequisite, request, transaction)` — invitation → USED or
  OWNER_APPROVAL → fulfilled for that exact request in approval transaction.

No Feature 006 method creates an invitation or OWNER approval. Missing/unavailable
authority is a hard denial, never a fallback to tax-ID match.

Deployment readiness must verify a named upstream company-access owner, contract
version, target-environment producer endpoint/state source, and passing
producer/consumer integration test. Existing-company approval remains disabled
until all four are present.

## BusinessEvidenceStorage

- `quarantine(stream, metadata)` — private encrypted source; no public URL.
- `openForSafety(evidenceId, lease)` — worker-only bytes after integrity check.
- `openForReview(evidenceId, actor)` — current request/evidence/step-up checked by
  service before provider; returns stream, not locator.
- `openSafePreview(evidenceId, actor)` — current authorized normalized preview.
- `markInaccessible`, `delete`, `reconcile` — idempotent retention operations.

Development uses a private gitignored filesystem root; production uses private
S3/SSE-KMS plus application encryption. Storage provider receives purpose and
retention metadata but never decides authorization/state.

## EvidenceSafetyPipeline

Stages: malware → detected-type agreement → structural integrity → preview
safety. A later stage runs only after earlier PASS. Any FAIL/INDETERMINATE keeps
evidence unreviewable. Attempt rows contain versions/timing/safe codes only.

The worker uses immutable request deadlines and current leases. Late output
cannot move a terminal/superseded request to PENDING_REVIEW.

## VerificationService

Commands: submit (Candidate), cancel (Candidate), resubmit (Candidate), request
changes, reject, and approve. Each command validates actor, exact state/version,
evidence, resubmission count, and relationship prerequisite.

Feature 006 does not expose the `assign` command. `assignedAdminUserId` is
nullable read-only workload metadata used only by the queue filter; a future
workload-routing contract may populate it. Feature 006 commands are submit,
cancel, resubmit, request changes, reject, and approve.

New/existing company approval writes Company/Membership/request/history/audit/
notification as one transaction. Timed transitions are idempotent worker
commands with one milestone notification each.

## ModerationService

- `submit(actor, targetContext, category, detail)` revalidates relationship,
  normalizes content, locks quota subject, applies unresolved/24-hour dedupe and
  10/24-hour quota, inserts report/admission/audit, and always returns the neutral
  accepted/duplicate receipt where specified.
- admin commands assign, add note, resolve, dismiss, and link enforcement with
  current authorization/version. No submit method imports/calls enforcement.
- terminal reports have no reopen operation.

## NotificationDispatcher

Claims SecurityNotificationWork by status/nextAttemptAt with lease. It renders
only allowlisted template fields, dispatches through the replaceable existing
email provider, classifies exact safe failure category, and schedules attempts at
immediate/+1m/+5m/+30m/+2h. Permanent failure, attempt-5 failure, or 24-hour
deadline sets MANUAL_INTERVENTION_REQUIRED. It never changes originating state.

SecurityNotificationWork is created for account suspension/reinstatement,
all-session revocation, and administrator-driven membership suspension,
restoration, or removal. Single-session revocation and moderation-only commands
create none. Verification approval/request-changes/rejection creates the
separate applicant Notification Work required by FR-037 by atomically inserting
one idempotent row into the existing `EmailOutbox`. Accepted submission or
resubmission receipt, applicant cancellation, and worker delay/expiry milestones
use that same existing outbox authority. Their idempotency identity binds the
request, submission version or milestone, resulting state, and notification
kind. The existing email worker performs later delivery; these applicant rows
do not use the FR-022 retry/manual-intervention projection. Report-linked access
enforcement reuses the underlying account/membership notification and the link
does not duplicate it.

## AuditWriter

Accepts a typed allowlisted event schema. Unknown context fields fail before
commit. Rationale/report/evidence/notes/credentials/session identifiers forbidden
by schema cannot be serialized. Correlation ID joins business result,
notification, rationale, and later enforcement without copying protected text.

## Admin worker control

One process runs independent leased loops for snapshots, evidence safety,
verification milestones, notifications, and retention cleanup. A failing loop
does not stop other loops or the web/Candidate/OCR/email features. Readiness
reports each loop separately. Shutdown stops claims and lets leases expire; it
does not mark in-flight work successful.

## SmartHire Support Center

- Candidate HTTP accepts only exact Candidate origin, current ACTIVE Better Auth session, and valid CSRF proof for writes.
- Admin HTTP reuses the designated Platform Administrator boundary; assignee commands additionally require current assignment and reviewed version.
- Requester projections expose case/message references, category, subject, state, timestamps, requester messages, and administrator messages labelled only `SmartHire Support`.
- Admin projections expose requester reference, assignment history, internal notes, messages, lifecycle history, and version but no Feature 008 conversation data.
- Realtime emits only `{ caseId, version, state, change }`; content is fetched through protected HTTP.
- Repository operations are transactional and idempotent for create, message, claim, reassign, reply, note, resolve, close, authority-loss requeue, auto-close, and retention.
