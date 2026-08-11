# Data Model: Recruiter Header Status

**Feature**: Recruiter Base Role — Group 1 Header Layout Change  
**Date**: 2026-08-11

## Overview

Group 1 introduces no persistent entity and requires no database migration. It defines one read-only projection, `RecruiterHeaderStatus`, derived from existing authoritative records only after the exact Candidate-host and existing session preconditions pass. The projection deliberately contains no account, company, membership, verification-request, or session identifier.

## Existing authoritative entities

### UserAccount

Represents the authenticated SmartHire account and its base Candidate identity.

Relevant attributes:

- `id`: used only inside the server trust boundary to scope status queries.
- `state`: only an account permitted to use the Candidate workspace can receive the projection.
- `companyMemberships`: current recruiter authority relationships.
- `recruiterVerificationRequests`: applicant-owned verification history.

### Session

Represents the existing opaque Better Auth database session. Group 1 creates no session and stores no credential.

Relevant attributes and policies:

- `userId`: scopes the session to the Candidate account.
- `expiresAt`: Better Auth sliding expiry, configured just under seven days.
- `absoluteExpiresAt`: hard seven-day limit that cannot slide.
- `lastActivityAt`: enforces the existing 30-minute idle limit and one-minute touch interval.
- `revokedAt`: makes an explicitly revoked session unusable.
- The related account must remain ACTIVE with no unfinished password reset or confirmed/completing full-account-recovery hold.
- The opaque token remains only in the configured HttpOnly, SameSite=Lax, production-Secure cookie; no recruiter status is added to the session or cookie.

### CompanyMembership

Represents one account's approved role in one company.

Relevant attributes:

- `userId`: relates the membership to the authenticated account.
- `companyId`: relates the membership to its company.
- `status`: only `ACTIVE` qualifies for approved header status.
- `role`: not exposed to the header projection.
- `version`: not exposed; recruiter-origin authorization rechecks it independently.

### Company

Represents a legal company identity.

Relevant attribute:

- `verificationState`: only `ACTIVE` combines with an ACTIVE membership to establish current recruiter entitlement.

### RecruiterVerificationRequest

Represents one employer-verification application submitted by a Candidate.

Relevant attributes:

- `applicantUserId`: scopes requests to the authenticated account.
- `state`: maps the latest request to the coarse header state when no current entitlement exists.
- `createdAt` and `id`: provide deterministic latest-request ordering.

No submitted company name, tax identifier, evidence reference, requested role, administrator assignment, note, or decision history is exposed to the header.

## Projection preconditions

These gates execute before the data-access operations below and are not persistent entities:

1. The existing page proxy rejects a non-Candidate or malformed public workspace host.
2. A shared server predicate independently confirms the exact configured Candidate host for both the initial layout projection and every later refresh. Failure produces a neutral unavailable/not-found outcome and performs no session, profile, service, or repository read.
3. The existing Better Auth session boundary validates the current opaque session and account state.
4. Only the resulting trusted current-account reference can enter the repository port.

The initial layout and later refresh therefore share identical host and account scoping even though only the refresh uses the HTTP response contract.

## Read boundary: RecruiterHeaderStatusRepositoryPort

This is a server-only data-access contract, not a persistent entity or API response. It keeps Prisma records and identifiers outside the business service.

| Operation | Input | Minimal result | Rules |
|---|---|---|---|
| `hasQualifyingMembership` | Trusted authenticated `userId` | `boolean` | Account-scoped existence only; ACTIVE membership joined to an ACTIVE verified company |
| `findLatestVerificationState` | Trusted authenticated `userId` | lifecycle `state` or `null` | Account-scoped; repository orders by `createdAt DESC`, then `id DESC`; identifiers and submitted fields do not leave the repository |

`PrismaRecruiterHeaderStatusRepository` is the only new module allowed to import Prisma for this feature. `RecruiterHeaderStatusService` receives the port through injection and owns state mapping, destination selection, and `observedAt` creation.

## Derived projection: RecruiterHeaderStatus

| Field | Type | Required | Rules |
|---|---|---:|---|
| `state` | `NEVER_APPLIED \| PENDING_REVIEW \| REJECTED \| APPROVED` | Yes | Exactly one of the four specification states |
| `destinationKind` | `NONE \| EMPLOYER_VERIFICATION \| RECRUITER_WORKSPACE` | Yes | Must agree with `state` |
| `href` | relative or absolute URL, or `null` | Yes | `null` only for pending; safe allowlisted destination otherwise |
| `observedAt` | offset date-time string | Yes | Time at which the server completed the authoritative read |

### Projection invariants

- `NEVER_APPLIED` pairs with `EMPLOYER_VERIFICATION` and `/dashboard/employer-verification`.
- `PENDING_REVIEW` pairs with `NONE` and `null`.
- `REJECTED` pairs with `EMPLOYER_VERIFICATION` and `/dashboard/employer-verification`.
- `APPROVED` pairs with `RECRUITER_WORKSPACE` and the exact configured recruiter origin.
- `APPROVED` must never be produced from an approved request alone; current active entitlement is required.
- The projection must never contain database identifiers or submitted business information.
- The response must not be cached in shared or persistent browser storage.

## Deterministic derivation

The service evaluates current authority before request history.

| Condition | Derived state | Destination |
|---|---|---|
| At least one ACTIVE membership whose company has `verificationState = ACTIVE` | `APPROVED` | Recruiter workspace |
| No qualifying membership; latest request is `PENDING_CHECKS` | `PENDING_REVIEW` | None |
| No qualifying membership; latest request is `PENDING_REVIEW` | `PENDING_REVIEW` | None |
| No qualifying membership; latest request is `CHANGES_REQUESTED` | `PENDING_REVIEW` | None |
| No qualifying membership; latest request is `RESUBMITTED` | `PENDING_REVIEW` | None |
| No qualifying membership; latest request is `REJECTED` | `REJECTED` | Employer verification |
| No qualifying membership; latest request is `CANCELLED` or `EXPIRED` | `NEVER_APPLIED` | Employer verification |
| No qualifying membership; latest request is `APPROVED` | `NEVER_APPLIED` | Employer verification |
| No qualifying membership and no request | `NEVER_APPLIED` | Employer verification |

The latest request is ordered by `createdAt DESC`, then `id DESC` to make ties deterministic.

## UI-only transient states

The following states are not persisted and do not appear in the success response contract:

### Loading

- Used only when no confirmed projection is available.
- Reserves the final action footprint.
- Announces that recruiter status is being checked.
- Has no destination and cannot be activated.

### Revalidating

- Retains the last confirmed label to prevent layout shift.
- Temporarily disables activation while the refresh is in flight.
- On success, replaces the projection atomically.
- On failure, transitions to `Unavailable`.

### Unavailable

- Uses the same disabled placeholder as initial loading.
- Exposes no guessed label or destination.
- Retries on the next visible polling interval or focus/visibility event.

### Navigating

- Retains the confirmed label and dimensions.
- Records only in memory that one opening attempt for the server-approved destination is active.
- Suppresses repeated activation until navigation succeeds or the current view becomes available again.
- Releases on synchronous opening failure, a cancelled/no-op same-origin attempt, unchanged-path return, focus/visibility return to the still-active document, or `pageshow` restoration.
- Successful external unload discards the transient state; it is never written to browser storage.
- Does not select another destination, construct a recruiter route, choose a company/workspace, represent destination progress or errors, change authorization, or animate a transition.

## State-change inputs

Group 1 performs no transition itself. Existing workflows can change the next derived result:

| Existing event | Possible projection change |
|---|---|
| Candidate submits a first request | `NEVER_APPLIED` → `PENDING_REVIEW` |
| Candidate resubmits requested changes | Remains `PENDING_REVIEW` |
| Administrator rejects the latest request | `PENDING_REVIEW` → `REJECTED` |
| Candidate submits again after rejection | `REJECTED` → `PENDING_REVIEW` |
| Administrator approves and creates/restores active membership | `PENDING_REVIEW` → `APPROVED` |
| Membership or company ceases to qualify | `APPROVED` → state derived from latest request; stale approval alone resolves to `NEVER_APPLIED` |
| Candidate cancels or the request expires | `PENDING_REVIEW` → `NEVER_APPLIED` |

## Query and scale characteristics

- One existence query for a qualifying current membership.
- At most one latest verification-request row.
- The fixed validation population contains at least 100 authenticated accounts with at least 25 per confirmed state and includes every lifecycle mapping, no-request/stale/tied histories, active/inactive entitlement, multi-company isolation, long profile values, and missing-avatar cases.
- Performance validation uses 20 concurrent Candidate sessions without changing the per-projection bounded-query rule.
- Existing indexes on membership/account relationships and `RecruiterVerificationRequest(applicantUserId, normalizedTaxIdentifier, state)` support bounded account-scoped reads.
- Repository integration/performance validation records the final query plan for representative account histories. If measurement demonstrates that a new account/latest-request index is required, implementation stops and the plan is revised explicitly before adding any migration; Group 1 does not silently introduce one.
- No unbounded collection, document evidence, or company-private projection is loaded.

## Migration and retention

- Database migration: none.
- Backfill: none.
- New retention rule: none.
- Rollback data work: none.
