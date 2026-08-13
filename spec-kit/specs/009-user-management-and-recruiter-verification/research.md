# Phase 0 Research: Admin User Management and Recruiter Verification

**Branch**: `009-user-management-and-recruiter-verification`  
**Date**: 2026-08-12  
**Inputs**: Clarified feature specifications, SmartHire Constitution 2.1.0,
Feature 006 administration implementation/design, Feature 007 recruiter-status
integration, and the current `web/` source tree.

No `NEEDS CLARIFICATION` item remains. The repository and approved architecture
baseline resolve every technology and integration choice; no web research or
new dependency is required.

## Decision 1: Extend the Feature 006 administration console

**Decision**: Implement Feature 009 inside the existing Next.js/React Admin
console, admin Route Handlers, services, Prisma repositories, admin worker, and
email worker.

**Rationale**: Feature 006 already owns exact-host authorization, the designated
administrator session, step-up proof, account commands, verification evidence,
company membership grants, audit, rationale, notification work, React Admin
provider behavior, and the required tests. Extending these boundaries avoids a
second authority path and preserves implemented security behavior.

**Alternatives considered**:

- Create a separate Admin application: rejected because it would duplicate
  authentication, protected caches, routes, workers, and provider configuration.
- Replace React Admin with custom pages: rejected because the existing console
  already supplies the approved data-dense list/detail/accessibility baseline.
- Add a new backend service: rejected because current load and domain boundaries
  fit the modular monolith and worker pattern.

## Decision 2: Keep Better Auth as the exclusive browser-session owner

**Decision**: Reuse the current opaque PostgreSQL-backed Better Auth cookie and
the existing Admin request boundary. No JWT, local token, or second session is
introduced.

**Rationale**: The constitution requires exactly one server-controlled browser
session. Existing code already validates account state, administrator grant,
designated session, expiry/replacement, and 15-minute proof.

**Alternatives considered**:

- An Admin-specific JWT: rejected as a prohibited second browser credential.
- React Admin token storage: rejected because protected credentials and records
  may not enter persistent client storage.
- Client-only role checks: rejected because presentation checks cannot authorize
  server data or commands.

## Decision 3: Derive account classification from active verified membership

**Decision**: A Recruiter-enabled account has at least one ACTIVE company
membership whose company verification state is ACTIVE. Candidate-only means no
such membership. Account lifecycle SUSPENDED does not remove that classification.

**Rationale**: The constitution and Features 006/007 define Recruiter as
company-scoped authority layered on base Candidate identity. A pending/rejected
verification request and a global role flag are not authority.

**Alternatives considered**:

- Add `UserAccount.type`: rejected because it conflicts with multi-company
  membership authority and duplicates state.
- Treat every Candidate as both account types: rejected because the directory
  toggle must distinguish effective Recruiter authority.
- Infer Recruiter from an APPROVED request alone: rejected because membership
  and company state remain the current entitlement authority.

## Decision 4: Use page-bounded bulk aggregates for directory activity

**Decision**: Select at most 100 account IDs, then calculate Candidate CV/
application counts and Recruiter job-status counts with bounded grouped queries.
Do not issue per-row queries and do not persist summary counters.

**Rationale**: This keeps counts current, prevents N+1 behavior, avoids a second
source of truth, and fits the P95 targets at the specified 10,000-account scale.
Existing indexes cover most joins; the migration adds only account discovery
indexes and any covering index proven necessary by query-plan evidence.

**Alternatives considered**:

- N+1 relation counts: rejected for unstable latency at 100 rows.
- Materialized counters: rejected because write synchronization/reconciliation
  is unnecessary at current scope and risks false values.
- Load all accounts then aggregate in memory: rejected as unbounded and unsafe.

## Decision 5: Add bounded persistence for applicant-visible rejection reason

**Decision**: Add nullable `RecruiterVerificationRequest.adminComment`, mapped
to the shared `admin_comment` contract field. Every new REJECTED transition must
write normalized 10–500-character content in the same transaction as request,
decision, audit, evidence inaccessibility, and notification work.

**Rationale**: Current code sends a generic rejected email and does not retain
the required applicant-visible reason. The request-level shared field is the
cross-module contract named by the specification and supports reapply guidance.

**Alternatives considered**:

- Put the reason in `VerificationDecisionHistory`: rejected because that history
  intentionally excludes reason text from the administrator/audit projection.
- Recover old reasons from audit/log/email: rejected because they were not
  stored authoritatively and fabrication would violate integrity.
- Store only the rejection category: rejected because the user explicitly
  requires a meaningful reason.

**Legacy rule**: Existing REJECTED rows with null `adminComment` remain immutable
and display an explicit legacy-unavailable state. No backfill text is invented.

## Decision 6: Keep verification assignment read-only

**Decision**: Preserve nullable `assignedAdminUserId` as workload metadata that
can be displayed and filtered, but expose no Claim, Unassign, or Reassign action.

**Rationale**: Feature 006 already documents assignment as read-only metadata
owned by a future routing workflow. Feature 009 contains no assignment user
story, transition, concurrency rule, or audit contract.

**Alternatives considered**:

- Add self-claim: rejected as unrequested mutation with incomplete ownership.
- Remove assignment entirely: rejected because existing data/filter contracts
  and the clarified queue field still use it.

## Decision 7: Use a shared transaction-local verification eligibility gate

**Decision**: Approve and Reject both invoke one eligibility loader that locks
and validates request/version, ACTIVE applicant, current qualified/accessible
evidence, administrator proof, and existing-company prerequisite/authority
conditions before any decision write.

**Rationale**: Current approval and rejection paths duplicate only part of the
decision gate. A shared boundary prevents drift and closes the suspension race.

**Alternatives considered**:

- UI-only disabling: rejected because state can change after rendering.
- Separate duplicated gate logic: rejected because approval/rejection could
  diverge under new rules.
- Change request state during suspension: rejected by clarification; suspension
  is an eligibility overlay and deadlines continue.

## Decision 8: Remove Request changes from the Group 2 action surface

**Decision**: Group 2 exposes only Approve and Reject. Remove the React Admin
control, provider command, and public Admin Route Handler for Request changes
from this feature surface while continuing to read historical
CHANGES_REQUESTED/RESUBMITTED states and support Candidate-side legacy flow.

**Rationale**: This is an explicit specification boundary. Retaining historical
states avoids data loss; exposing a third current decision would violate it.

**Alternatives considered**:

- Keep the button for compatibility: rejected because current administrators
  would still have an unapproved third action.
- Remove lifecycle states/data: rejected because Feature 007 and existing
  records depend on them.

## Decision 9: Reuse the evidence lifecycle and reconcile every exit

**Decision**: Superseded evidence and evidence for REJECTED, CANCELLED, or
EXPIRED requests becomes inaccessible immediately and is deleted within 24
hours. APPROVED evidence remains accessible while the associated company is
ACTIVE, then becomes inaccessible immediately and is deleted within 30 days.

**Rationale**: This is the already approved Feature 006 privacy contract and
matches the clarified Group 2 specification. The existing leased cleanup worker
can enforce it idempotently.

**Alternatives considered**:

- Retain rejected evidence for audit: rejected because decision/audit metadata
  remains sufficient and raw evidence has a hard deletion deadline.
- Delete all approved evidence immediately: rejected because it is still the
  active company-verification basis.
- Pause deadlines for suspended applicants: rejected by clarification.

## Decision 10: Project moderation history from AuditEvent

**Decision**: Treat the specification's `AccountModerationLog` as a read model
over allowlisted account action `AuditEvent` rows, correlated with protected
rationale and security-email delivery status.

**Rationale**: `AuditEvent` is already append-only and constitutionally
authoritative. A new log table would create duplication, atomicity complexity,
and reconciliation risk.

**Alternatives considered**:

- Add `AccountModerationLog` table: rejected as a second audit source.
- Embed history on `UserAccount`: rejected because it is unbounded and mutable.
- Return raw audit context: rejected because only allowlisted fields may leave
  the audit boundary.

## Decision 11: Block both Suspend and Restore for current administrators

**Decision**: At the transaction boundary, deny both actions whenever the target
has a current unexpired ACTIVE Platform Administrator grant. Administrator
authority must be revoked through its separate operator command first.

The denial commits one allowlisted audit event and stable command receipt but
no account/session/challenge mutation, rationale, or security notification. If
the denial audit cannot be committed, the target remains unchanged and the
caller receives only a safe correlated failure.

**Rationale**: This exactly implements clarification A and is safer than only a
last-admin check. It also makes the action rule deterministic and avoids an
account with active administration authority becoming a Group 3 target.

**Alternatives considered**:

- Block only self/last administrator: rejected by clarification.
- Revoke the grant inside suspension: rejected because Group 3 may not manage
  administrator authority.
- Client-only hiding: rejected because stale/direct requests must be denied.

## Decision 12: Preserve company jobs and applications independently

**Decision**: Suspension mutates only account/session/challenge/audit/rationale/
security-email records. It never changes memberships, verification requests,
jobs, applications, stages, or scores. Other authorized recruiters may continue
the normal application workflow.

**Rationale**: Jobs and applications are company/recruitment records with their
own authority and lifecycle. This matches clarifications A/A and prevents
implicit content moderation.

**Alternatives considered**:

- Auto-hide authored jobs: rejected because visibility belongs to job/company/
  moderation state.
- Freeze Candidate applications for recruiters: rejected because suspension
  only blocks the Candidate account.
- Clone records on restore: rejected because preservation retains the original
  authoritative record.

## Decision 13: Use mandatory email-only security work

**Decision**: Every committed Suspend/Restore creates one
`SecurityNotificationWork` whose sole delivery channel is the existing
`EmailOutbox`; account security preference cannot suppress this mandatory
security notice. Group 3 creates no in-app notification record.

Its allowlisted payload carries action, resulting state, occurrence time,
non-sensitive reason category, next action, and support/dispute destination;
protected rationale and administrator/session/audit details are excluded.

**Rationale**: A suspended user cannot rely on authenticated in-app access. The
existing email worker, five-attempt schedule, safe failure categories, and
manual-intervention projection already satisfy reliability requirements.

**Alternatives considered**:

- Email plus in-app: rejected by clarification and would require per-channel
  delivery authority.
- In-app only: rejected because the suspended user may never receive it.
- Send synchronously inside the transaction: rejected because provider failure
  must not corrupt or roll back the account outcome.

## Decision 14: Canonicalize Restore without rewriting history

**Decision**: New UI/contract/domain names use Restore and `ACCOUNT_RESTORED`.
Historical `admin.account_reinstated` and `ACCOUNT_REINSTATED` values are mapped
to Restore presentation when read; immutable rows are not rewritten.

**Rationale**: This aligns current language with the clarified specification
while preserving audit/outbox integrity and deployed compatibility.

**Alternatives considered**:

- Continue using Reinstate: rejected because it creates terminology drift.
- Rewrite historical audit/outbox rows: rejected because immutable evidence
  must not be changed.
- Maintain both UI actions: rejected as confusing duplicate functionality.

## Decision 15: Publish an OpenAPI delta plus UI/provider contract

**Decision**: Define the Feature 009 HTTP changes in one OpenAPI delta and the
React Admin behavior in one Markdown UI/provider contract, both explicitly
extending the Feature 006 contracts.

**Rationale**: Route/schema parity is already enforced by the repository. A
delta avoids copying unrelated Feature 006 endpoints while making every changed
interface reviewable.

**Alternatives considered**:

- Rewrite the full Feature 006 OpenAPI file: rejected because it would create a
  competing full contract and noisy duplication.
- Document UI only: rejected because server trust boundaries and command errors
  need a machine-readable contract.
