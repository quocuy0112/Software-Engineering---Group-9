# Data Model: Candidate Application Tracking and Private CV Match

## Existing Authorities Extended

### JobApplication

Existing authority from Features 012/015. Preserve `@@unique([candidateUserId, jobPostingId])`, immutable profile/CV/job snapshots, `APPLIED` initial stage, `stageVersion`, and stage history.

Add or formalize:

- `submissionMessage`: bounded immutable one-way Candidate message snapshot, nullable.
- `withdrawalOutcome`: nullable `CANDIDATE_WITHDRAWN`; not an `ApplicationStage`.
- `withdrawnAt`, `withdrawnByUserId`, `withdrawalVersion`: nullable outcome provenance.
- `activeProcessingStoppedAt`: set with withdrawal so workers cannot advance active work.
- relations to intake, notification preference, and public update records.

Rules:

1. Withdrawal fields are all null or a complete consistent set.
2. Withdrawal succeeds only when the locked current stage is before `INTERVIEWING` and no outcome exists.
3. Canonical `stage` and `stageVersion` are preserved by withdrawal.
4. Employer evaluation data remains on its existing independent lineage and is never returned by Candidate projections.

### ApplicationStageEvent

Remains canonical recruiter-pipeline history. Candidate projection includes only `candidateVisible=true` events and an allow-listed public copy. Withdrawal is not inserted as a fake stage event; it receives a public update and audit event.

### JobPosting and JD Version

The current `JobPosting.version` and immutable `jobSnapshot` provide submission provenance. Private check creation materializes an immutable JD snapshot/version/digest so later job edits cannot change a saved result.

### CandidateCv and CV Version

Existing Candidate-owned immutable CV source. Creation revalidates owner, `confirmedAt`, `archivedAt`, parse/extraction readiness, checksum, size, MIME type, and version. Private and submitted snapshots have separate purpose/access metadata.

## New Application-Side Entities

### CandidateApplicationDraft

| Field | Rule |
|---|---|
| `id` | Stable opaque identifier |
| `candidateUserId`, `jobPostingId` | Unique pair and ownership boundary |
| `revision` | Monotonic optimistic-concurrency value |
| `personalInfoDraft` | Validated bounded candidate fields only |
| `selectedCvId` | Candidate-owned CV reference |
| `coverLetterDraft` | Optional bounded text/file draft descriptor |
| `messageDraft` | Optional bounded one-way message |
| `confirmationAccepted` | Review UI state only; submit rechecks explicit confirmation |
| `createdAt`, `updatedAt`, `expiresAt` | `expiresAt = updatedAt + 30 days` after each successful edit |

Transitions: `ACTIVE -> SUBMITTED` or `ACTIVE -> EXPIRED/DELETED`. Expiry never creates an Application or work.

### ApplicationIntake

| Field | Rule |
|---|---|
| `applicationId` | One-to-one with `JobApplication` |
| `state` | `RECEIVED`, `CHECKING_FILES`, `SENT_TO_RECRUITER`, `ATTENTION_REQUIRED` |
| `progressPercent` | Monotonic 0-100 derived from completed steps |
| `receivedAt`, `checkingStartedAt`, `sentAt` | Nullable monotonic timestamps |
| `failureCode` | Safe technical code only; no CV content |
| `leaseOwner`, `leaseExpiresAt`, `attemptCount` | Background ownership/recovery |
| `version`, `updatedAt` | Optimistic read/update version |

State flow:

```text
RECEIVED -> CHECKING_FILES -> SENT_TO_RECRUITER
                    |-> ATTENTION_REQUIRED -> CHECKING_FILES
withdrawal at an eligible stage -> work cancelled; history retained
```

### ApplicationPublicUpdate

Candidate-safe timeline event with `applicationId`, kind, public stage/outcome, localization variables, effective timestamp, deduplication key, and source event reference. It cannot contain score, rank, employer note/reason, or other Candidate data.

### ApplicationNotificationPreference

One-to-one per Application: `emailEnabled`, `inAppEnabled`, `version`, `updatedAt`. Defaults come from existing account policy only at Application creation; later changes are application-local.

## Candidate-Private Match Entities

### PrivateCvMatchCheck

| Field | Rule |
|---|---|
| `id` | Candidate-private opaque identifier |
| `candidateUserId` | Sole ordinary reader/commander |
| `cvVersionId`, `cvVersion`, `cvDigest` | Fixed owned CV provenance |
| `jobPostingId`, `jdVersion`, `jdDigest` | Job used for setup/navigation plus immutable provenance; no company access relation |
| `scoringConfigVersion` | Fixed approved 40/60 configuration |
| `currentAttemptId` | Nullable pointer changed only by safe publication |
| `state` | `QUEUED`, `ANALYZING`, `LIMITED`, `READY`, `FAILED`, `INACCESSIBLE` |
| `createdAt`, `expiresAt` | Expiry exactly 12 months after creation |
| `inaccessibleAt`, `deleteAfter`, `deletedAt` | Immediate logical denial and ≤30-day physical cleanup |
| `deleteLeaseOwner`, `deleteLeaseExpiresAt`, `deleteAttempts`, `deleteFailureCode` | Recoverable cleanup metadata |

Constraints:

- No `applicationId`, company membership, recruiter user, employer evaluation, or ranking-result relation.
- Candidate ownership is included in every hot query and mutation predicate.
- Expired/inaccessible rows return the same unavailable response as missing/not-owned rows.

### PrivateCvMatchAttempt

Immutable attempt keyed to one check and the check's fixed inputs.

Fields: `id`, `checkId`, `attemptNumber` (unique per check), `trigger` (`INITIAL`/`AI_RETRY`), `state`, deterministic-result reference, nullable AI-result reference, nullable hybrid result and band, start/completion timestamps, safe failure code, provider/model/prompt/policy provenance, and worker lease metadata.

State flow:

```text
QUEUED -> AUTOMATIC_RUNNING -> AUTOMATIC_READY -> AI_RUNNING
  -> READY (automatic + AI + hybrid atomically publish)
  -> LIMITED (automatic publishes; AI absent)
  -> FAILED (no safe deterministic publication)

LIMITED check -> retry attempt reuses deterministic result -> READY or LIMITED
```

Only `READY` or `LIMITED` attempts may become current. A retry does not blank the prior current attempt.

### PrivateAutomaticMatchResult

Immutable private deterministic component: score 0-100, 40% weight, weighted contribution for display, required/preferred matches, required/detected experience, gaps with reason codes, evidence excerpts with type/location, evidence coverage, parser provenance, calculation time, and `mayBeIncomplete` warning.

### PrivateAiEvaluationResult

Immutable schema-validated private AI component: score 0-100, 60% weight, weighted contribution, summary, strengths/main gap, prioritized truthful actions, evidence confidence and level, model/provider/prompt/policy versions, duration, and completion timestamp. Sensitive/job-irrelevant attributes and raw provider response are not retained.

### PrivateMatchEvidence

Normalized private evidence linked only to deterministic result: criterion identity/version, classification, bounded CV quote, location, confidence metadata, and exclusion flags. Evidence coverage/confidence do not contribute to the hybrid score.

## Shared Value Objects, Not Shared Persistence

### ScoringInput

Immutable sanitized CV snapshot, JD snapshot, structured criteria, parser versions, and scoring-config version. Contains no Candidate demographics, Application ID, company authority, persistence destination, or recruiter data.

### HybridScorePolicy

- Automatic weight: `0.40`
- AI weight: `0.60`
- Calculate full precision, round final once to one decimal.
- High Match: 80.0-100.0; Medium Match: 60.0-79.9; Low Match: below 60.0.
- Hybrid/band absent when AI result is absent.

## Audit and Notification Integration

- Existing audit authority records submit, withdrawal, private deletion result, and AI failure using IDs/codes only—never CV quotes or report contents.
- Unified notification rows reference Application context only. Private check completion/retry is shown on its owning page and may use a candidate-only safe notification kind only if later approved; it never targets recruiters.
- Withdrawal notification uses Application context and a unique business-event key.

## Indexes and Integrity

- Draft: unique `(candidateUserId, jobPostingId)`, work index `(expiresAt, id)`.
- Intake: unique `applicationId`, work index `(state, leaseExpiresAt, updatedAt)`.
- Public update: unique deduplication key; timeline index `(applicationId, effectiveAt desc, id desc)`.
- Preference: unique `applicationId`.
- Private check: owner list index `(candidateUserId, createdAt desc, id desc)`; cleanup indexes on `(expiresAt, inaccessibleAt)` and `(deleteAfter, deletedAt)`.
- Attempt: unique `(checkId, attemptNumber)`; work index `(state, leaseExpiresAt, id)`.
- Current attempt foreign key must belong to the same check; enforce in transactional publication and migration verification.

## Migration and Rollback

1. Preflight existing Application uniqueness, stage versions/events, snapshot bindings, and CV/JD versions; abort on inconsistency.
2. Add new tables/enums/indexes and nullable withdrawal fields additively; do not rewrite existing stages or scores.
3. Do not fabricate drafts, intake history, private checks, or withdrawal outcomes for legacy rows. Existing Applications get default notification preferences and a safe synthesized `SENT_TO_RECRUITER` intake projection only when authoritative submission evidence proves completion.
4. Deploy schema/readers/workers before enabling new write entry points.
5. Verify no private table is reachable through employer repository relations or API schemas.
6. Roll back entry points and workers without dropping additive tables or clearing audit/history; recover through forward migration.
