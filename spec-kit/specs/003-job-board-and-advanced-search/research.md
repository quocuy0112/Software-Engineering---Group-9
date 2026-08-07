# Research: Job Board and Advanced Search

## Decision 1: Extend the existing modular monolith

**Decision**: Implement inside the existing `web` Next.js workspace with App Router pages/handlers, services, repositories, and shared Zod contracts.

**Rationale**: This preserves one deployable unit and browser-session owner and matches the constitutional layered architecture.

**Alternatives considered**: A search microservice or standalone frontend; both add deployment/session complexity before scale requires it.

## Decision 2: Deterministic normalized PostgreSQL search

**Decision**: Persist normalized searchable text and use parameterized PostgreSQL filtering with `pg_trgm` indexes. Normalize through Unicode decomposition, combining-mark removal, explicit `đ` mapping, lowercase, and whitespace collapse.

**Rationale**: Meets case- and Vietnamese-diacritic-insensitive search without AI and remains explainable and indexable.

**Alternatives considered**: `unaccent` alone, hosted search, or browser filtering; each gives less control, an unnecessary provider, or the wrong trust/scale boundary.

## Decision 3: Keyset pagination

**Decision**: Use bounded keyset pagination with deterministic sort keys and job-ID tie-breakers. Encode cursor payloads as opaque base64url JSON validated by a versioned schema.

**Rationale**: Avoids large offsets and duplicate results caused by inserts ahead of a cursor while retaining safe shareable URLs.

**Alternatives considered**: Offset pagination and stateful result sessions.

## Decision 4: Server-render public pages with small client islands

**Decision**: Render list/detail content on the server from URL criteria; use client components only for save, report, application, and pending feedback.

**Rationale**: Public content remains useful without hydration and sensitive mutation state stays server-owned.

**Alternatives considered**: Fully client-rendered search and static generation; neither provides as direct an authoritative public/action boundary.

## Decision 5: Public allowlists and neutral unavailability

**Decision**: Return dedicated public projections. Removed, private, pending, rejected, and unknown postings map to one neutral unavailable outcome.

**Rationale**: Prevents enumeration and leakage of moderation, recruiter, report, or company-private data.

**Alternatives considered**: Exposing lifecycle reasons or filtering generic persistence records in the UI.

## Decision 6: Reuse Better Auth and existing CSRF controls

**Decision**: Protected actions use `requireSession`, same-origin validation, session-bound CSRF proof, active-account checks, and strict schemas.

**Rationale**: The constitution permits exactly one browser-session mechanism and the repository already supplies the controls.

**Alternatives considered**: Route JWTs or browser-storage tokens, both disallowed by the baseline.

## Decision 7: Database uniqueness is the concurrency authority

**Decision**: Use unique saved-job/application constraints, a nullable unique unresolved report key, and candidate-scoped idempotency keys bound to application submissions.

**Rationale**: Client disabling and pre-checks cannot prevent races; the database provides deterministic outcomes.

**Alternatives considered**: Read-then-write checks only or distributed locks.

## Decision 8: Transactional immutable application snapshots

**Decision**: In one transaction, lock/recheck eligibility, create the `Applied` application, preserve job/profile/CV/question/consent snapshots, create answers, append audit, and enqueue notification work.

**Rationale**: Later edits cannot rewrite submission evidence, delivery failure cannot invalidate a submission, and partial success is prohibited.

**Alternatives considered**: References to mutable rows only or post-commit best-effort audit.

## Decision 9: Explicit confirmed-CV boundary

**Decision**: Add only provider-independent confirmed CV metadata/reference required by application submission. Upload, parsing, storage provider, and confirmation UI remain outside this feature.

**Rationale**: UC-APP-01 requires a confirmed CV without justifying expansion into a different functional group.

**Alternatives considered**: Applying without a CV or implementing full CV management here.

## Decision 10: Provider-neutral notification work

**Decision**: Persist idempotent candidate and company notification intents related to the application; the notification group/provider delivers them later.

**Rationale**: Fulfills durable scheduling and failure isolation without a second email mechanism or recruiter-recipient policy in this group.

**Alternatives considered**: Synchronous email or silently omitting company notification intent.

## Decision 11: Reuse the database rate limiter for reports

**Decision**: Reuse `RateLimitBucket` with a privacy-preserving user-derived subject while the unresolved key handles semantic duplicates.

**Rationale**: Abuse volume and duplicate concerns are distinct, and the existing limiter is auditable and server-enforced.

**Alternatives considered**: Browser throttling or raw IP-only limiting.

## Decision 12: No new runtime package

**Decision**: Use native Unicode/`Intl`, Zod, Prisma/pg, and existing UI primitives.

**Rationale**: The current exact package set covers the feature and avoids added supply-chain/lockfile risk.

**Alternatives considered**: New slug, transliteration, search, or state libraries whose marginal value is insufficient.

## Decision 13: Keep retained application CVs separate from Feature 004 imports

**Decision**: Continue consuming a confirmed retained `CandidateCv` through a provider-independent boundary. Do not treat Feature 004 uploads, artifacts, drafts, provenance, or confirmation receipts as application attachments. Production UC-APP-01 is gated until an approved retained-document producer supplies that boundary.

**Rationale**: Feature 004 is purpose-limited to temporary Profile import and must delete confirmed source content within seven days. Reusing those locators would break its consent and retention contract; treating a content-free receipt as a CV would weaken the approved application use case.

**Alternatives considered**: Silently retain a Feature 004 source, use a confirmation receipt as the attachment, or remove CV selection from UC-APP-01. Each conflicts with an approved feature boundary or use-case requirement.

## Decision 14: Keep one Feature 003 migration before merge

**Decision**: Keep all Feature 003 database work in `009_job_board_advanced_search`, including the exact decimal 5,000,000-byte CV constraint. Represent all three JobPosting trigram indexes in Prisma with raw GIN operator classes. Feature 004 retains the preceding `008_cv_upload_parse_review` directory.

**Rationale**: A single feature migration is easier to review and matches the user's branch workflow. Feature 004 occupies `008_cv_upload_parse_review`, and Feature 003 follows it as `009_job_board_advanced_search`, so the migration prefixes are sequential. Omitting unsupported/raw indexes from Prisma causes generated development migrations to propose destructive drops.

**Alternatives considered**: Keep a second Job Board hardening migration, accept the generated index-drop migration, or retain the old 5 MiB cap. The first adds avoidable pre-merge history and the others create performance or constitutional problems.
