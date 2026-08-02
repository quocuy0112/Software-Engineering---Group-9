# Job Board Requirements Checklist: Job Board and Advanced Search

**Purpose**: Reviewer gate for requirement completeness, clarity, consistency, measurability, and scenario coverage across the five requested use cases
**Created**: 2026-08-01
**Feature**: [spec.md](../spec.md)

**Depth**: Standard release-review rigor
**Audience**: Specification/plan reviewer before implementation

## Requirement Completeness

- [x] CHK001 Are public browse, search, filtering, sorting, pagination, empty, invalid, changed-state, and service-failure requirements all defined? [Completeness, Spec FR-001–FR-008]
- [x] CHK002 Are active, closed, expired, unavailable, authenticated-action, and prior-interaction detail requirements all defined? [Completeness, Spec FR-009–FR-014]
- [x] CHK003 Are save, remove, duplicate, concurrent, unavailable-job, session-expiry, and persistence-failure requirements defined? [Completeness, Spec FR-015–FR-018]
- [x] CHK004 Are report reason/detail, privacy, unresolved-duplicate, rate-limit, audit, persistence-failure, and non-enforcement requirements defined? [Completeness, Spec FR-019–FR-022]
- [x] CHK005 Are profile/CV prerequisites, questions, consent, final recheck, snapshots, uniqueness, rollback, audit, and notification-failure requirements defined for application submission? [Completeness, Spec FR-023–FR-030]

## Requirement Clarity

- [x] CHK006 Is “public posting” defined by approval, lifecycle, publication, deadline/closing, and public-field rules rather than a vague visibility flag? [Clarity, Spec FR-002, FR-010–FR-012]
- [x] CHK007 Is Vietnamese-diacritic-insensitive search behavior distinguished from preservation of original displayed text? [Clarity, Spec FR-003]
- [x] CHK008 Are filter dimensions, sort choices, deterministic tie-breaking, query bounds, and pagination expectations explicit? [Clarity, Spec FR-004–FR-007; Plan Search Design]
- [x] CHK009 Is the initial application status reconciled with the canonical `Applied` stage, avoiding a conflicting `Submitted` stage? [Consistency, Spec Clarifications; FR-027]
- [x] CHK010 Is “confirmed CV” bounded by ownership, confirmation, archival, file-type, size, and commit-time recheck requirements? [Clarity, Spec FR-024, FR-026; Data Model CandidateCv]

## Requirement Consistency

- [x] CHK011 Do the specification, plan, data model, API description, and tasks consistently exclude AI search/recommendations and automatic report enforcement? [Consistency, Spec Scope; Plan Constitution Check; Tasks US1/US5]
- [x] CHK012 Do protected-action requirements consistently reuse one server-controlled browser session and require same-origin/CSRF validation without client ownership input? [Consistency, Spec FR-031; Plan Security Controls; Contracts HTTP Boundary]
- [x] CHK013 Are public-cache requirements consistent with actor-scoped saved/applied action state so one user's state cannot be publicly cached for another? [Consistency, Internal Contracts HTTP Boundary]
- [x] CHK014 Are application transaction requirements consistent across rollback, immutable snapshots, audit atomicity, and provider-independent notification failure? [Consistency, Spec FR-027–FR-030; Data Model Transaction Boundaries]

## Acceptance Criteria Quality

- [x] CHK015 Can the two-second search/detail and three-second page-load claims be measured with a documented dataset, environment, method, and sample size? [Measurability, Spec SC-001–SC-002; Quickstart Performance Evidence]
- [x] CHK016 Can Vietnamese equivalence, inactive-record exclusion, duplicate prevention, rollback, authorization, and accessibility outcomes be objectively evaluated? [Measurability, Spec SC-003–SC-008]
- [x] CHK017 Does each user story include an independent test and Given/When/Then scenarios covering success plus meaningful alternatives/failures? [Acceptance Criteria, Spec User Scenarios]

## Scenario and Edge-Case Coverage

- [x] CHK018 Are visitor, authenticated user, eligible Candidate, inactive account, expired session, and other-user scenarios represented where authorization changes behavior? [Coverage, Spec Edge Cases; Quickstart Authorization Matrix]
- [x] CHK019 Are concurrent save/remove/report/apply requests and authoritative final-state behavior addressed in requirements and tasks? [Coverage, Spec Edge Cases; Tasks T033, T043, T049]
- [x] CHK020 Are neutral unavailable responses specified without leaking missing/private/pending/rejected/removed distinctions? [Privacy, Spec FR-012; Contracts NeutralJobUnavailable]
- [x] CHK021 Are unsafe text, malformed cursors/enums/ranges, empty results, partial failures, and provider failures addressed with recovery behavior? [Coverage, Spec Edge Cases; Quickstart Walkthroughs]

## Non-Functional and Governance Requirements

- [x] CHK022 Are keyboard, labels, focus, contrast, non-color state, meaningful feedback, and 320-pixel responsive requirements defined for every interactive flow? [Accessibility, Spec FR-034, SC-008]
- [x] CHK023 Are least privilege, Vietnamese data-policy obligations, retention/deletion boundaries, and privacy-minimized logging/audit requirements documented? [Security/Privacy, Spec FR-032–FR-033; Plan Security Controls]
- [x] CHK024 Are migration integrity, clean/upgrade verification, indexes, uniqueness, rollback/recovery, and no-production-seed requirements documented? [Data Integrity, Plan Migration; Quickstart Migration Gate]

## Dependencies and Scope

- [x] CHK025 Are job management/moderation, CV upload/parsing, tracking, scoring, pipeline, and delivery dependencies explicitly separated without weakening this feature's required integration boundaries? [Scope, Spec Assumptions and Scope Boundaries]
- [x] CHK026 Is the Must MVP defined as the complete browse-to-application workflow rather than an incomplete search-only slice? [Scope, Tasks Implementation Strategy; Constitution Principle V]
- [x] CHK027 Are both requested Should use cases retained as independently testable P2 increments instead of silently omitted or promoted over incomplete Must work? [Scope, Spec Clarifications; Tasks US4/US5]

## Notes

- Reviewed 2026-08-01 against `spec.md`, `plan.md`, `data-model.md`, both contract documents, `quickstart.md`, and `tasks.md`.
- 27/27 requirement-quality checks pass; runtime behavior remains subject to the generated test and release tasks.
- Re-reviewed 2026-08-02 against Features 002/004; the separate retained-CV boundary, exact 5,000,000-byte cap, inherited session lifecycle, and forward-only post-merge hardening are covered by `integration-boundaries.md`.
