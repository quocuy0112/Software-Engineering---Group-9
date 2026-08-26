# Data Model: Candidate Profile Discovery and Recruiter Review

## CandidateProfileVisibility

One row per `CandidateIdentity`; it contains no profile copy.

| Field | Rules |
|---|---|
| `candidateUserId` | Primary key/FK to Candidate identity; cascades with candidate deletion. |
| `discoverableByExactId` | Boolean, default `false`; required for Candidate lookup. |
| `candidateSections` | Strict set: avatar, headline, summary, location, skills, experience, education, links. Phone is never selectable. |
| `recruiterSections` | Independent strict set for Recruiter-after-application view. |
| `version`, `createdAt`, `updatedAt` | Optimistic concurrency and audit timestamps. |

An absent row means fully hidden. The initial visibility save creates it.

## JobApplicationContactConsent

One row per submitted application; controls future projection of the application’s existing `contactSnapshot`.

| Field | Rules |
|---|---|
| `applicationId` | Primary key/FK to JobApplication. |
| `sharedAt` | Nullable grant timestamp. |
| `withdrawnAt` | Nullable withdrawal timestamp. Consent is active only when shared and not withdrawn. |
| `version`, `createdAt`, `updatedAt` | Concurrency and lifecycle evidence. |

The record stores no contact values. Withdrawal blocks future views only.

## JobApplication retention extension

Existing snapshots/documents remain authoritative. Add application-profile snapshot review deadline (`submittedAt + 12 months`) and nullable access-denied timestamp. Extend the existing application-retention worker to deny snapshot projection at expiry unless a legal hold blocks it.

## RateLimitBucket and AuditEvent extensions

Reuse HMAC-digested subjects. Add profile-discovery atomic admission semantics for account/network minute limits, unsuccessful rolling-hour limits, and `blockedUntil`. Extend existing strict audit actions/context for visibility save, lookup returned/neutral/blocked, consent grant/withdraw, and recruiter profile/snapshot/contact access. Never store raw queried IDs, contact values, or profile bodies.

## Lifecycle

```text
CandidateIdentity 1 ── 0..1 CandidateProfileVisibility
CandidateIdentity 1 ── *    JobApplication
JobApplication    1 ── 1    JobApplicationContactConsent
JobApplication    1 ── *    ApplicationDocument (existing immutable evidence)
```

1. Candidate saves visibility with version check and audit.
2. Lookup admission checks account/network limits, loads only active discoverable target, projects Candidate sections, and writes safe audit outcome.
3. Submission saves immutable application evidence and initial contact consent atomically.
4. Consent withdrawal becomes effective immediately for new projections.
5. Recruiter re-authorizes application, loads snapshot/current policy/consent, redacts, and audits.
6. Retention worker denies expired snapshot review while preserving legal-hold and audit obligations.
