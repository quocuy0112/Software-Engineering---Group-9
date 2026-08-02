# Feature 003 US3 Apply for a Job Results

**Recorded**: 2026-08-02  
**Use case**: UC-APP-01  
**Priority / release class**: P1 / Must  
**Engineering result**: PASS  
**Production release**: BLOCKED pending retained-CV producer and migration gates

## Automated Evidence

One focused Vitest invocation covered application eligibility/snapshots, the
application transaction behavior, form/submission contracts, application form
rendering, and accessibility.

Result: **5 test files passed; 9 tests passed; 0 failed**.

The shared contract/architecture gate separately verifies exact acceptance at
`5,000,000` bytes, rejection at `5,000,001` bytes, Prisma index representation,
and the prohibition on using Feature 004 temporary artifacts as application
attachments.

## Behaviors Observed

- Profile, retained-CV, job, answer, consent, duplicate, and idempotency policy
  is covered by focused tests.
- Application, snapshots, answers, audit, and notification work have
  all-or-nothing repository coverage.
- Form validation, pending/error recovery, semantics, and narrow layout are
  covered.
- Notification delivery work remains distinct from the authoritative commit.

## Explicit Release Dependency

Controlled `CandidateCv` fixtures validate Feature 003's consumer boundary only.
Feature 004 intentionally owns temporary import sources and deletes confirmed
source content within seven days; its artifacts/receipts cannot satisfy
UC-APP-01. Production Apply must stay disabled until an approved retained private
document producer supplies purpose/consent, malware, encryption, retention and
deletion, archival, and replacement guarantees.

## Gate Conclusion

The US3 implementation slice is green, but this file does not approve production
release. The retained-CV producer and clean/upgraded database migration evidence
must pass first.

---

## Requirements Dossier: US3: Apply for a Job

**Use case**: UC-APP-01
**Priority**: P1
**Release class**: Must
**Primary actor**: Authenticated active Candidate
**Requirements**: FR-023 through FR-034
**HTTP contracts**: `GET /api/jobs/{jobId}/application-form`,
`POST /api/jobs/{jobId}/applications`

### Outcome

An eligible candidate submits exactly one application in `APPLIED`, with the
selected retained CV, answers, consent, immutable snapshots, audit evidence,
and notification work committed atomically.

### Preconditions and Release Dependency

- The server session resolves an active Candidate identity; user/candidate IDs
  are never accepted as ownership input.
- The job remains approved, active, published, and before its deadline/close.
- Required profile name, headline, and location are present.
- The selected `CandidateCv` is candidate-owned, confirmed, unarchived,
  PDF/DOCX, and exactly `1..5,000,000` bytes.
- `CandidateCv` must come from an approved retained private-document producer.
  Feature 004 uploads, stored artifacts, drafts, extracted text, provenance,
  cleanup locators, and confirmation receipts are temporary import sources and
  cannot be promoted implicitly to application attachments.
- Production Apply remains release-blocked until that retained-document producer
  and its consent, malware, encryption, retention/deletion, and replacement
  boundaries are approved. Controlled test fixtures validate only this consumer.

### Primary Flow

1. The candidate opens the application form for a public, accepting job.
2. The service returns required-profile readiness, safe retained-CV options,
   active questions, consent version, and any existing application.
3. The candidate selects a CV, answers every active required question, may add
   bounded optional content, explicitly accepts consent, and confirms submit.
4. The protected handler validates session, origin/CSRF, strict body, and an
   opaque idempotency key bound to the normalized submission.
5. Inside one transaction, the repository rechecks every eligibility rule and
   creates the application, profile/CV/job snapshots, answers, audit event, and
   durable candidate/company notification work.
6. The authoritative application identifier and `APPLIED` stage are returned;
   asynchronous notification delivery may retry without changing validity.

### Alternate, Race, and Failure Outcomes

| Condition                                               | Required outcome                                    |
| ------------------------------------------------------- | --------------------------------------------------- |
| Missing profile, retained CV, answer, or consent        | Block commit and identify actionable missing input. |
| Foreign/archived/unconfirmed/oversized CV               | Return safe ineligibility; create nothing.          |
| Job closes after form load                              | Recheck in transaction and reject; create nothing.  |
| Same candidate/job submitted repeatedly or concurrently | Return the one existing successful application.     |
| Idempotency key reused for different normalized content | Return `409 IDEMPOTENCY_KEY_REUSED`.                |
| Persistence/audit/outbox transaction fails              | Roll back all application artifacts.                |
| Notification provider fails after commit                | Keep application valid and durable work retryable.  |
| Feature 004 receipt is supplied as CV                   | Reject; never resolve it to temporary content.      |

### Privacy, Snapshot, and Accessibility Rules

- Form options omit storage keys, checksums, raw content, reports, moderation,
  and other candidates. Snapshots are bounded, private, versioned, and immutable.
- Logs/audit omit CV content, answers, cover letter, credentials, cookies, raw
  headers, and storage/provider details.
- Required questions, CV choice, consent, validation summaries, pending state,
  error focus, retry, and confirmation work by keyboard and at 320 CSS pixels.

### Independent Acceptance Matrix

- Test valid submission plus missing profile/CV/answers/consent, every answer
  type, exact CV byte boundaries, foreign/archived CV, closed/expired job, stale
  consent, expired session, forged ownership, duplicate/concurrent submission,
  reused idempotency key, injected transaction failure, and notification failure.
- Inspect one authoritative PostgreSQL outcome, immutable snapshots, audit, and
  notification work without recording sensitive fixture content in evidence.

### Traceability

- Tasks: T032-T042 and hardening task T066.
- Source: `application-policy.ts`, `prisma-job-application-repository.ts`,
  `job-application-service.ts`, both application Route Handlers,
  `job-application-form.tsx`, and `job-detail.tsx`.
- Generated tests: application policy, PostgreSQL application transaction,
  application contract, form component, accessibility, and architecture boundary.

### Exit Gate

The implementation slice is green when its five focused suites pass and every
duplicate/failure case has one all-or-nothing result. Production UC-APP-01 is
still blocked until the retained-CV producer and database migration gates pass.
