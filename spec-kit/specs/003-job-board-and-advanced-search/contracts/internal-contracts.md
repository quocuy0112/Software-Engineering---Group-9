# Internal Contracts: Job Board and Advanced Search

These interfaces describe stable responsibilities, not concrete provider or ORM signatures. Transport handlers translate HTTP into these values; business services never accept client-selected ownership.

## Shared Value Rules

```ts
type JobActor =
  | { kind: "visitor" }
  | { kind: "user"; userId: string; sessionId: string };

type CandidateActor = {
  userId: string;
  sessionId: string;
};

type PublicJobState = "ACTIVE" | "CLOSED" | "EXPIRED";

type ServiceProblem = {
  code: string;
  status: 400 | 401 | 403 | 404 | 409 | 429 | 503;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
};
```

`userId`, `sessionId`, account state, company ownership, and Candidate identity are always derived server-side. A public transport body/query containing ownership properties is invalid.

## Normalization Contract

```ts
normalizeSearchText(value: string): string
```

The result is deterministic:

1. trim;
2. Unicode NFD decomposition;
3. remove combining marks;
4. map `đ`/`Đ` to `d`/`D` before lowercase;
5. lowercase with a fixed locale-independent rule;
6. replace punctuation used only as separators with spaces;
7. collapse repeated whitespace.

Normalization never replaces original display values. Input and output length bounds are enforced before persistence/query execution.

## Cursor Contract

```ts
type JobSearchCursorV1 = {
  v: 1;
  sort: "RELEVANCE" | "NEWEST" | "SALARY_DESC";
  score?: number;
  publishedAt: string;
  salaryMaximum?: string | null;
  id: string;
};

encodeJobCursor(value: JobSearchCursorV1): string;
decodeJobCursor(value: string): JobSearchCursorV1 | ServiceProblem;
```

- Cursor is base64url-encoded, max 1,024 characters, and validated strictly.
- Its sort must match the current request.
- It contains no actor, session, private posting, report, or application data.
- Invalid/mismatched cursors produce `400 JOB_SEARCH_CURSOR_INVALID`.

## Public Job Repository

```ts
interface PublicJobRepository {
  search(
    input: NormalizedJobSearch,
    actorUserId: string | null,
    now: Date,
  ): Promise<{
    rows: PublicJobCardRow[];
    total: number;
    nextCursor: string | null;
  }>;

  findPublicBySlug(
    slug: string,
    actorUserId: string | null,
    now: Date,
  ): Promise<PublicJobDetailRow | null>;

  findPublicActionTarget(
    jobId: string,
    now: Date,
  ): Promise<{
    id: string;
    state: PublicJobState;
    acceptsApplications: boolean;
  } | null>;
}
```

Repository projections contain only fields enumerated by OpenAPI. `null` is the only result for missing/private/pending/rejected/removed identifiers at the public boundary.

## Job Discovery Service

```ts
interface JobDiscoveryService {
  search(
    rawQuery: unknown,
    actor: JobActor,
    now?: Date,
  ): Promise<JobSearchResponse | ServiceProblem>;

  detail(
    rawSlug: unknown,
    actor: JobActor,
    now?: Date,
  ): Promise<JobDetail | ServiceProblem>;
}
```

Responsibilities: strict parsing, normalization, cursor validation, public availability, action projection, public serialization, safe `503` conversion, and cache policy hints.

## Saved Job Repository and Service

```ts
interface SavedJobRepository {
  save(userId: string, jobId: string, now: Date): Promise<void>;
  remove(userId: string, jobId: string): Promise<void>;
  isSaved(userId: string, jobId: string): Promise<boolean>;
}

interface SavedJobService {
  setSaved(
    actor: JobActor,
    jobId: unknown,
    saved: boolean,
    now?: Date,
  ): Promise<
    { jobId: string; saved: boolean; message: string } | ServiceProblem
  >;
}
```

- Save uses unique-create-or-read semantics.
- Remove scopes deletion to `(actor.userId, jobId)` and missing is successful.
- Any database error returns the prior state as authoritative; the client must refetch/reconcile.

## Job Report Contract

```ts
type JobReportCommand = {
  reason:
    | "FRAUD"
    | "MISLEADING"
    | "DUPLICATE"
    | "DISCRIMINATORY"
    | "INAPPROPRIATE"
    | "OTHER";
  details: string | null;
};

interface JobReportRepository {
  submitPending(input: {
    reporterUserId: string;
    jobId: string;
    reason: JobReportCommand["reason"];
    details: string | null;
    unresolvedKey: string;
    correlationId: string;
    occurredAt: Date;
  }): Promise<{ created: boolean }>;
}
```

Report service ordering:

1. active session + same-origin + CSRF at request boundary;
2. strict reason/detail validation and plain-text normalization;
3. database-backed rate limit using a digest, never raw IP/report body;
4. neutral public job target lookup;
5. transactionally create report and privacy-minimized `job.report.submitted` audit;
6. unique unresolved-key conflict returns `{ received: true, duplicate: true }`.

Rate-limit policy for initial implementation: at most 5 accepted report attempts per authenticated account per rolling 15-minute window. The response uses `429`, safe `Retry-After`, and audit context `{ reason: "rate_limit" }` without report content.

## Application Form Query

```ts
interface ApplicationFormRepository {
  getCandidateForm(
    userId: string,
    jobId: string,
    now: Date,
  ): Promise<{
    job: EligibleJobProjection;
    profile: CandidateProfileProjection;
    confirmedCvs: CandidateCvOption[];
    questions: ApplicationQuestionProjection[];
    existingApplication: ApplicationOutcome | null;
  } | null>;
}
```

The projection must not include storage keys, checksum, full profile, CV content, report/moderation fields, or another candidate. `profileReady` initially requires non-empty candidate name, profile headline, and location; confirmed CV remains a separate eligibility requirement.

## Application Submission Contract

```ts
type ApplicationSubmissionCommand = {
  cvId: string;
  answers: Array<{ questionId: string; value: string | boolean }>;
  coverLetter: string | null;
  consentVersion: string;
  consentAccepted: true;
};

interface JobApplicationRepository {
  submit(input: {
    candidateUserId: string;
    jobId: string;
    idempotencyKey: string;
    submissionBindingDigest: string;
    command: ApplicationSubmissionCommand;
    activeConsentVersion: string;
    occurredAt: Date;
    correlationId: string;
  }): Promise<{ application: ApplicationOutcome; created: boolean }>;
}
```

### Transaction invariants

- Account is active and CandidateIdentity belongs to the session user.
- Job remains approved/active/published and deadline/close time has not passed.
- CV belongs to the candidate, is confirmed, unarchived, PDF/DOCX, and <= 5 MB.
- Required profile fields, active questions, answer kind/choice/bounds, and active consent version are satisfied.
- Existing `(candidateUserId, jobId)` is authoritative; a matching retry returns it.
- Existing `(candidateUserId, idempotencyKey)` with another binding returns `409 IDEMPOTENCY_KEY_REUSED`.
- New stage is exactly `APPLIED`.
- Application, snapshots, answers, successful `job.application.submitted` audit, candidate confirmation work, and company new-application work commit together.
- Notification payload references contain IDs/template version only, not raw profile/CV/answer/cover content.

### Snapshot shapes

```ts
type ProfileSnapshotV1 = {
  v: 1;
  candidateName: string;
  headline: string;
  location: string;
  skills: Array<{ id: string; label: string }>;
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string | null;
  }>;
};

type CvSnapshotV1 = {
  v: 1;
  cvId: string;
  cvVersion: number;
  displayName: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  storageKey: string;
  confirmedAt: string;
};

type JobSnapshotV1 = {
  v: 1;
  jobId: string;
  jobVersion: number;
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  workArrangement: string;
  requiredSkills: string[];
};
```

Snapshots are private and bounded at the service boundary. Later lifecycle edits never update them.

## Audit Contract

| Action                      | Result         | Allowed context                                        |
| --------------------------- | -------------- | ------------------------------------------------------ |
| `job.report.submitted`      | SUCCESS        | reason enum, duplicate=false                           |
| `job.report.denied`         | DENIED/FAILURE | safe reason code only                                  |
| `job.application.submitted` | SUCCESS        | application ID, job ID, stage, notification-work count |
| `job.application.denied`    | DENIED         | safe eligibility/conflict code only                    |
| `job.application.failed`    | FAILURE        | safe persistence code only                             |

Every record includes actor, session where applicable, target, result, correlation ID, and timestamp. Context never includes query text, CV/profile snapshot, answers, cover letter, report details, cookie/token, raw headers, raw IP, provider error, or database error.

## HTTP Boundary Rules

- Public GET handlers may cache briefly but never cache actor-specific action state publicly. If action state is included for an authenticated actor, response is `private, no-store` or action state is fetched separately.
- All protected responses are `Cache-Control: no-store`.
- Handlers return strict contract bodies and never raw thrown errors.
- Login return destinations are internal absolute paths beginning `/jobs/`, length-bounded, and rejected if they contain credentials or an origin/host.
- `503` never presents incomplete search results or a partial application as successful.
