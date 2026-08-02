# Integration Boundary Requirements Checklist: Job Board and Advanced Search

**Purpose**: Reviewer gate for requirement clarity and consistency across Features 002, 003, and 004 after the Feature 004 merge
**Created**: 2026-08-02
**Feature**: [spec.md](../spec.md)

**Depth**: Standard release-review rigor
**Audience**: Specification/plan reviewer before implementation or release

## Requirement Completeness

- [x] CHK001 Is the retained `CandidateCv` dependency distinguished from Feature 004 temporary import sources, artifacts, drafts, provenance, and receipts? [Completeness, Spec FR-024; Plan Retained CV Boundary]
- [x] CHK002 Is the production release consequence defined when no approved retained-CV producer exists? [Completeness, Spec Clarifications; Plan Retained CV Boundary]
- [x] CHK003 Are the required retained-document producer concerns—purpose/consent, malware safety, encrypted storage, retention/deletion, archival, and replacement boundary—enumerated? [Completeness, Plan Retained CV Boundary]

## Requirement Clarity and Consistency

- [x] CHK004 Is the CV byte limit consistently defined as decimal `1..5,000,000` rather than the ambiguous term “5 MB” or binary 5 MiB? [Clarity, Spec FR-024; Data Model CandidateCv; OpenAPI CandidateCvOption]
- [x] CHK005 Is the exclusive Better Auth session lifecycle consistent with Features 001, 002, and 004, including production/local cookie names, expiry, revocation, and persistence? [Consistency, Plan Inherited Browser Session Boundary]
- [x] CHK006 Are anonymous public caching and authenticated actor-scoped no-store behavior distinguished so saved/applied state cannot cross users? [Consistency, Plan Inherited Browser Session Boundary; Internal Contracts HTTP Boundary]
- [x] CHK007 Are UC-JOB-03 and UC-JOB-05 explicitly retained as P2/Should increments while UC-JOB-04 remains a deliberate backlog item? [Scope, Spec Clarifications]

## Migration and Verification Coverage

- [x] CHK008 Does the plan keep Feature 003 in one reviewable migration before merge while preserving the distinct Feature 004 migration and defining the no-edit rule after application? [Data Integrity, Plan Migration and Recovery]
- [x] CHK009 Are the three reviewed GIN trigram indexes represented as schema invariants and protected from generated drop migrations? [Coverage, Plan Migration and Recovery; Quickstart Migration Gate]
- [x] CHK010 Are clean, Feature 002-upgraded, and Feature 004-upgraded validation paths required before release? [Coverage, Plan Migration and Recovery]
- [x] CHK011 Do generated tests cover the exact byte boundary and prohibit implicit temporary-import promotion at the architecture boundary? [Traceability, Tasks T066-T068]

## Notes

- 11/11 requirement-quality checks pass after the 2026-08-02 cross-feature clarification.
- Runtime and migration evidence is recorded separately; this checklist evaluates the requirements themselves.
