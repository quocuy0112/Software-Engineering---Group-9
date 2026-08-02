# Data Model: Job Board and Advanced Search

## Conventions

- PostgreSQL is authoritative. All timestamps are UTC instants and public display uses the user's configured timezone.
- IDs are opaque strings. Browser clients never choose ownership fields.
- Original Vietnamese display text and deterministic normalized search text are stored separately.
- Free text is bounded plain text. Public serializers use explicit allowlists rather than exposing persistence records.
- `JobApplication` snapshots are private immutable/versioned evidence. They may include opaque storage references but never a browser-session credential or provider secret.

## Enums

### JobPostingStatus

`DRAFT | PENDING_REVIEW | ACTIVE | CLOSED | EXPIRED | REJECTED | REMOVED`

Only `ACTIVE` enters search. A posting that was previously public may retain a public historical detail view when `CLOSED` or `EXPIRED`. All other non-active states use a neutral unavailable response.

### EmploymentType

`FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | TEMPORARY`

### ExperienceLevel

`ENTRY | JUNIOR | MID | SENIOR | LEAD | MANAGER`

### WorkArrangement

`ONSITE | HYBRID | REMOTE`

### SalaryPeriod

`HOUR | MONTH | YEAR`

### ApplicationQuestionKind

`TEXT | BOOLEAN | SINGLE_CHOICE`

### JobReportReason

`FRAUD | MISLEADING | DUPLICATE | DISCRIMINATORY | INAPPROPRIATE | OTHER`

### JobReportStatus

`PENDING_REVIEW | RESOLVED | DISMISSED`

### ApplicationStage

`APPLIED | VIEWED | SHORTLISTED | INTERVIEWING | OFFERED | HIRED | OFFER_DECLINED | REJECTED | WAITLISTED`

This feature creates only `APPLIED`. Later recruiter workflow owns validated human-controlled transitions.

### RecruitmentNotificationAudience

`CANDIDATE | COMPANY`

### RecruitmentNotificationKind

`APPLICATION_SUBMITTED | APPLICATION_RECEIVED`

Work status reuses the existing `OutboxStatus` enum.

## Entities

### Company

Public company identity needed by public job projections. Company membership, verification documents, and recruiter authorization remain separate future-owned data.

| Field                 | Type               | Rules                                      |
| --------------------- | ------------------ | ------------------------------------------ |
| id                    | opaque ID          | primary key                                |
| slug                  | string             | unique, lowercase canonical URL segment    |
| legalName             | string             | 1-200; not automatically public            |
| displayName           | string             | 1-160; approved public name                |
| logoUrl               | nullable URL       | HTTPS public asset only                    |
| websiteUrl            | nullable URL       | HTTP(S), no embedded credentials           |
| publicDescription     | nullable text      | at most 3,000 characters                   |
| publicLocation        | nullable string    | at most 160 characters                     |
| verifiedAt            | nullable timestamp | required before its jobs may become public |
| createdAt / updatedAt | timestamp          | managed by server/database                 |

Relationships: one Company has many JobPostings.

### JobPosting

| Field                    | Type                  | Rules                                                               |
| ------------------------ | --------------------- | ------------------------------------------------------------------- |
| id                       | opaque ID             | primary key                                                         |
| companyId                | Company ID            | required, restrictive FK                                            |
| slug                     | string                | globally unique stable public URL segment                           |
| title                    | string                | 1-200 public characters                                             |
| normalizedTitle          | string                | deterministic normalization of title                                |
| summary                  | string                | 1-500 plain-text characters                                         |
| description              | text                  | 1-20,000 plain-text characters                                      |
| responsibilities         | text                  | 1-12,000 plain-text characters                                      |
| requirements             | text                  | 1-12,000 plain-text characters                                      |
| benefits                 | nullable text         | at most 8,000 characters                                            |
| location                 | string                | 1-160 display characters                                            |
| normalizedLocation       | string                | deterministic normalization of location                             |
| employmentType           | EmploymentType        | required                                                            |
| experienceLevel          | ExperienceLevel       | required                                                            |
| workArrangement          | WorkArrangement       | required                                                            |
| salaryMin / salaryMax    | nullable decimal      | non-negative; min <= max; both-or-neither for filtering             |
| salaryCurrency           | nullable string       | three uppercase ISO-style characters when salary exists             |
| salaryPeriod             | nullable SalaryPeriod | required when salary exists                                         |
| searchDocumentNormalized | text                  | normalized approved title/company/location/skill/content projection |
| status                   | JobPostingStatus      | default `DRAFT`                                                     |
| approvedAt               | nullable timestamp    | required for historical/public visibility                           |
| publishedAt              | nullable timestamp    | required and <= now for active search                               |
| applicationDeadline      | nullable timestamp    | no new applications after this instant                              |
| closedAt / removedAt     | nullable timestamp    | state-consistent lifecycle evidence                                 |
| version                  | positive integer      | increment when approved/searchable content changes                  |
| createdAt / updatedAt    | timestamp             | managed                                                             |

Relationships: belongs to Company; has skills, questions, saved relationships, reports, and applications.

Indexes: unique slug; `(status, publishedAt, applicationDeadline, id)`; salary/filter indexes; GIN trigram indexes on normalized title, location, and search document.

### JobPostingSkill

Joins a posting to the existing normalized `Skill` catalog.

| Field                  | Type      | Rules                                     |
| ---------------------- | --------- | ----------------------------------------- |
| jobPostingId / skillId | IDs       | composite primary key, restrictive FKs    |
| displayName            | string    | 1-80; approved spelling                   |
| required               | boolean   | whether the posting declares it mandatory |
| position               | integer   | non-negative, unique within posting       |
| createdAt              | timestamp | managed                                   |

### ApplicationQuestion

| Field                 | Type                       | Rules                                       |
| --------------------- | -------------------------- | ------------------------------------------- |
| id                    | opaque ID                  | primary key                                 |
| jobPostingId          | JobPosting ID              | required FK                                 |
| prompt                | string                     | 1-500 plain-text characters                 |
| description           | nullable text              | at most 1,000 characters                    |
| kind                  | ApplicationQuestionKind    | required                                    |
| required              | boolean                    | required-answer policy                      |
| options               | nullable JSON string array | 2-20 unique values only for `SINGLE_CHOICE` |
| position              | integer                    | non-negative, unique within posting         |
| version               | positive integer           | snapshot traceability                       |
| active                | boolean                    | only active questions appear on new forms   |
| createdAt / updatedAt | timestamp                  | managed                                     |

### CandidateCv

Minimal integration record consumed from the candidate CV workflow.

| Field                  | Type                      | Rules                                                |
| ---------------------- | ------------------------- | ---------------------------------------------------- |
| id                     | opaque ID                 | primary key                                          |
| candidateUserId        | CandidateIdentity user ID | required FK, owner derived from session              |
| displayName / fileName | string                    | bounded display metadata                             |
| mimeType               | string                    | PDF or DOCX media type                               |
| byteSize               | integer                   | 1 through 5 MB constitutional limit                  |
| storageKey             | string                    | opaque provider-independent private object reference |
| checksumSha256         | string                    | 64 lowercase hex characters                          |
| version                | positive integer          | immutable content version                            |
| confirmedAt            | nullable timestamp        | must be non-null to apply                            |
| archivedAt             | nullable timestamp        | archived CV cannot be newly selected                 |
| createdAt / updatedAt  | timestamp                 | managed                                              |

Relationships: belongs to CandidateIdentity; may be referenced by many applications. Deleting a CV is restricted while required by retained application evidence.

### SavedJob

| Field                 | Type      | Rules                                                |
| --------------------- | --------- | ---------------------------------------------------- |
| userId / jobPostingId | IDs       | composite primary key; one relationship per user/job |
| createdAt / updatedAt | timestamp | managed                                              |

The owning user comes from the server session. Saving an existing row and deleting a missing row are successful idempotent outcomes.

### JobReport

| Field                              | Type            | Rules                                                                                  |
| ---------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| id                                 | opaque ID       | primary key                                                                            |
| reporterUserId                     | UserAccount ID  | required private FK                                                                    |
| jobPostingId                       | JobPosting ID   | required FK                                                                            |
| reason                             | JobReportReason | required                                                                               |
| details                            | nullable text   | 20-2,000 required for `OTHER`, `MISLEADING`, and `DISCRIMINATORY`; otherwise max 2,000 |
| status                             | JobReportStatus | default `PENDING_REVIEW`                                                               |
| unresolvedKey                      | nullable string | unique deterministic digest while pending; null after resolution                       |
| createdAt / updatedAt / resolvedAt | timestamps      | state-consistent                                                                       |

Only authorized moderation code may read report identity/content or move state. Submission does not change JobPosting.

### JobApplication

| Field                               | Type                      | Rules                                                              |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| id                                  | opaque ID                 | primary key                                                        |
| candidateUserId                     | CandidateIdentity user ID | owner derived from session                                         |
| jobPostingId                        | JobPosting ID             | required restrictive FK                                            |
| selectedCvId                        | CandidateCv ID            | required, owned and confirmed at commit                            |
| stage                               | ApplicationStage          | created as `APPLIED`                                               |
| coverLetter                         | nullable text             | at most 5,000 characters                                           |
| profileSnapshot                     | JSON                      | bounded private projection used at submission                      |
| cvSnapshot                          | JSON                      | confirmed CV version/metadata/private reference used at submission |
| jobSnapshot                         | JSON                      | approved job/company/version projection used at submission         |
| consentVersion                      | string                    | 1-64, must equal active server consent version                     |
| consentedAt                         | timestamp                 | commit-time acceptance evidence                                    |
| idempotencyKey                      | string                    | 16-128 opaque characters, unique per candidate                     |
| submissionBindingDigest             | string                    | binds key to normalized job/CV/answers/cover/consent input         |
| submittedAt / createdAt / updatedAt | timestamps                | managed                                                            |

Constraints: unique `(candidateUserId, jobPostingId)` and `(candidateUserId, idempotencyKey)`. Relationships: has answers and notification work.

### ApplicationAnswer

| Field            | Type                   | Rules                                                 |
| ---------------- | ---------------------- | ----------------------------------------------------- |
| id               | opaque ID              | primary key                                           |
| applicationId    | JobApplication ID      | cascade with application only under approved deletion |
| questionId       | ApplicationQuestion ID | restrictive trace FK                                  |
| questionSnapshot | JSON                   | prompt/kind/options/required/version at submission    |
| answer           | JSON scalar            | validated against question kind and bounds            |
| createdAt        | timestamp              | managed                                               |

Constraint: unique `(applicationId, questionId)`.

### RecruitmentNotificationWork

| Field                                    | Type                            | Rules                                            |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------ |
| id                                       | opaque ID                       | primary key                                      |
| applicationId                            | JobApplication ID               | required FK                                      |
| audience                                 | RecruitmentNotificationAudience | candidate or owning company                      |
| kind                                     | RecruitmentNotificationKind     | submission confirmation or new application       |
| targetReference                          | string                          | candidate user ID or company ID, not a raw email |
| payloadRef                               | JSON                            | minimum IDs/template version; no raw CV/answers  |
| idempotencyKey                           | string                          | globally unique                                  |
| status                                   | OutboxStatus                    | starts `PENDING`                                 |
| attempts / nextAttemptAt / safeErrorCode | delivery state                  | no provider body/error                           |
| createdAt / updatedAt                    | timestamps                      | managed                                          |

## Transaction Boundaries

### Save / Remove

- Save uses create-or-read under `(userId, jobPostingId)` uniqueness.
- Remove deletes only the session user's composite key and treats missing as success.

### Report

1. Validate session, CSRF, reason/details, and rate bucket.
2. Verify the job was public or retainable for safe moderation context.
3. Build the private unresolved digest and create `JobReport` plus privacy-minimized audit in one transaction.
4. On unique conflict, return the existing neutral already-received outcome.

### Apply

1. Validate session, CSRF, strict input, idempotency key, and submission digest.
2. In a serializable/retry-safe transaction, lock/re-read CandidateIdentity, CandidateProfile, CandidateCv, JobPosting/company/questions, and duplicate application.
3. Reject inactive account, unconfirmed/foreign/archived CV, unavailable job, expired deadline, missing required profile data/answers/consent, or changed idempotency binding.
4. Create `JobApplication`, snapshots, answers, one successful AuditEvent, and two provider-neutral notification work rows.
5. Commit once; notification delivery occurs later and cannot roll back the application.

## State Transitions

```text
JobPosting (external management/moderation owns writes)
DRAFT -> PENDING_REVIEW -> ACTIVE -> CLOSED or EXPIRED
PENDING_REVIEW -> REJECTED
ACTIVE/CLOSED/EXPIRED -> REMOVED (authorized moderation only)

JobReport (external moderation owns review)
PENDING_REVIEW -> RESOLVED or DISMISSED

JobApplication
[create] -> APPLIED
Later transitions follow the constitutional canonical pipeline and require human recruiter authority.
```

## Deletion and Retention

- Public removal is a lifecycle change, not physical deletion. Saved jobs may retain only a neutral reference.
- User/account deletion immediately blocks access; retained application/report/audit evidence follows the approved legal retention and deletion process.
- Application snapshots and answers cannot be altered by later profile/CV/job edits.
- Physical deletion order, when approved, removes notification work and answers before applications; shared JobPosting/Skill/Company records are not cascaded from a candidate deletion.
