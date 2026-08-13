# Data Model: Submitted Candidates List & CV Access — Group 1

## Existing JobApplication (extended)

`JobApplication` remains the sole submission and pipeline aggregate. Existing identity, candidate/job relations, idempotency, snapshots, stage/history and notification relations are preserved.

| Field | Rule |
|---|---|
| `id` | Existing stable primary key |
| `candidateUserId`, `jobPostingId` | Existing required authority relations; unique pair |
| `stage` | Existing canonical enum; new accepted submission is exactly `APPLIED` |
| `stageVersion` | Existing value starts at 1 |
| `lastStageChangedAt`, `submittedAt` | Existing authoritative server timestamps |
| `selectedCvId` | Existing source selection relation retained for candidate history; not recruiter document authority |
| `documentRetentionDueAt` | Nullable until calculable; later of job closure/terminal-stage time plus 12 months |
| `documentAccessDeniedAt` | Nullable exact logical-denial time; reads enforce independently of cleanup |
| `documentDeletionDueAt` | Nullable; no later than 30 days after denial/valid erasure event |
| `documentDeletedAt` | Set only after all private application content is purged |
| `legacyDocumentState` | `CURRENT`, `BACKFILLABLE`, or `UNAVAILABLE`; only complete-document rows enter Group 1 list |
| existing scoring fields | Ignored by Group 1; later versioned evaluation authority required |

Existing unique `(candidateUserId, jobPostingId)` and candidate idempotency constraints remain. Add list index `(jobPostingId, submittedAt DESC, id DESC)` and cleanup index `(documentDeletedAt, documentDeletionDueAt)`.

An accepted creation transaction requires `stage=APPLIED`, version 1, an initial stage event, exactly one committed CV artifact, at most one cover-letter representation, idempotency binding and an allowlisted audit outcome.

## ApplicationDocument

Immutable application-owned private artifact.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `jobApplicationId` | Required FK to existing JobApplication |
| `kind` | `CV` or `COVER_LETTER` |
| `storagePurposeVersion` | Fixed versioned application-document purpose |
| `storageKeyEncrypted` | Provider-neutral encrypted locator; never returned |
| `originalFilenameEncrypted` | Normalized encrypted filename |
| `mediaType` | PDF or approved DOCX type |
| `byteLength` | 1–5,000,000 |
| `contentDigestHmac` | Purpose-separated integrity token; never returned |
| `sourceCandidateCvId`, `sourceCandidateCvVersion` | Submission-time provenance without making source mutable authority |
| `safetyAssessmentId` | Proof accepted bytes passed approved validation |
| `committedAt` | Non-null only after application transaction binds promotion |
| `ordinaryAccessDeniedAt` | Exact denial copied/derived from aggregate policy |
| `deleteAfter`, `deletedAt` | Physical cleanup deadline/outcome |
| `createdAt` | Server timestamp |

Constraints: unique `(jobApplicationId, kind)`; exactly one committed CV; at most one file cover letter; immutable identity/content/binding after commit; ordinary open requires before denial, not deleted and not ordinary-access excluded by hold.

## ApplicationCoverLetterText

Optional immutable encrypted text alternative.

| Field | Rule |
|---|---|
| `jobApplicationId` | Primary key/FK |
| `textEncrypted` | Normalized text rendered as text only |
| `characterCount` | 1–10,000 Unicode characters |
| `ordinaryAccessDeniedAt`, `deleteAfter`, `deletedAt` | Same policy as artifacts |
| `createdAt` | Server timestamp |

Exactly one of text cover letter, file cover letter or neither is permitted. Existing plaintext `JobApplication.coverLetter` is migrated only when it is authoritative, then scrubbed by the approved migration.

## ApplicationArtifactPromotion

Durable promotion/reconciliation state for external storage work.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `candidateUserId`, `jobPostingId` | Purpose binding before Application exists |
| `jobApplicationId` | Nullable until committed |
| `kind`, `storagePurposeVersion` | Exact intended artifact purpose |
| `storageKeyEncrypted` | Private random locator |
| `state` | `PROMOTED`, `COMMITTED`, `DELETE_PENDING`, `DELETING`, `DELETED`, `DELETE_FAILED` |
| `orphanDeleteAfter` | Promotion time plus 24 hours unless committed |
| `leaseOwner`, `leaseExpiresAt` | Recoverable cleanup ownership |
| `attemptCount`, `lastSafeFailureCode` | Content-free retry metadata |
| `createdAt`, `updatedAt`, `deletedAt` | Server timestamps |

Only `COMMITTED` promotion may back an ApplicationDocument. Failed transaction promotion is denied immediately and must reach `DELETED` by `orphanDeleteAfter`.

## ApplicationDocumentLegalHold

Restricted preservation record; never grants recruiter access.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `jobApplicationId` | Held aggregate |
| `purposeCode`, `policyVersion` | Allowlisted legal purpose/version; no free-form candidate content |
| `issuedByAdminUserId` | Authorized issuer |
| `startsAt`, `reviewAt`, `endsAt`, `releasedAt` | Bounded lifecycle |
| `createdAt` | Server timestamp |

At least one current hold postpones physical deletion only. Ordinary access remains denied at its normal deadline. Release recomputes deletion due no later than 30 days after the final hold ends.

## Existing ApplicationStageEvent and AuditEvent

- Initial event: `fromStage=null`, `toStage=APPLIED`, version 1, same transaction/time as application acceptance.
- Existing later transition owner remains unchanged and outside Group 1.
- Audit allowlist stores correlation identifier, available actor, `APPLICATION_SUBMITTED`, available application/job target, safe success/failure result and timestamp; no document, contact, filename, locator or score content. Success is inserted with the accepted-application transaction; rejected/failed attempts are inserted after rollback without partial application data. Both are deleted at the governing 365-day baseline through the shared audit-retention process.

## RecruiterSubmittedCandidate Projection

Returns only application ID, permitted display identity/avatar or fallback, verified email, application-shared phone, submitted time, and CV/cover-letter availability/media type. It excludes content, provider locator, unrelated profile fields, legacy-unavailable rows, exact total, score and rationale.

## State Machines

### Submission

```text
validated exact artifacts -> PROMOTED
  -> transaction commits JobApplication(APPLIED v1) + stage event + documents + audit
     -> COMMITTED
  -> transaction fails
     -> DELETE_PENDING -> DELETING -> DELETED (hard deadline 24h)
```

### Retention

```text
AVAILABLE
  -> ACCESS_DENIED at retention deadline or valid erasure event
  -> DELETE_PENDING
     -> HELD (physical deletion postponed; ordinary access stays denied)
     -> DELETING -> DELETED
     -> DELETE_FAILED -> DELETE_PENDING
```

Final physical deadline is 30 days after denial or final hold release. Lease loss discards stale worker results.

## Migration Rules

1. Preflight current unique/stage/version/source evidence and abort on inconsistencies.
2. Add new tables/fields without changing Better Auth or canonical stage enums.
3. Backfill only when exact CandidateCv bytes, digest and version are provable; otherwise set `legacyDocumentState=UNAVAILABLE` and report content-free counts/IDs to authorized operations.
4. Never synthesize from `appliedJobIds[]` or JSON demo data and never substitute current CV.
5. Preserve current JobApplication IDs, timestamps, stage/version/history and candidate tracking.
6. Scrub authoritative migrated plaintext cover letter only after encrypted destination verification.
7. Rollback is disablement plus forward fix; logical denial and cleanup remain enabled.
