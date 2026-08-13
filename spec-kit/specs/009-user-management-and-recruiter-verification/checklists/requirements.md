# Specification Quality Checklist: Admin User Management and Recruiter Verification

**Purpose**: Validate all three sequential functional-group specifications before implementation planning  
**Created**: 2026-08-12  
**Feature**: [Specification index](../spec.md)

## Artifact Structure

- [x] `spec.md` is an index rather than a combined group specification
- [x] Group 1 has one peer specification file
- [x] Group 2 has one peer specification file
- [x] Group 3 has one peer specification file
- [x] No group-specific directory exists
- [x] Only one shared specification-quality checklist exists
- [x] The index defines group order, boundaries, and links to every specification

## Group 1 — User Account Directory

**Specification**: [Group 1](../spec-group-1-user-account-directory.md)

### Content Quality

- [x] No implementation details such as languages, frameworks, or APIs
- [x] Focused on administrator value and read-only business needs
- [x] Written for non-technical stakeholders
- [x] User stories, UI states, data model, edge cases, acceptance criteria, and measurable outcomes are complete

### Requirement Completeness

- [x] No unresolved clarification markers or template placeholders remain
- [x] Requirements and acceptance criteria are testable and unambiguous
- [x] Candidate-only, recruiter-enabled, combined, Active, and Suspended populations are defined
- [x] Search, filters, stable ordering, pagination, exact row fields, and exact detail fields are defined
- [x] Candidate and Recruiter counts, zero values, multi-company aggregation, and freshness behavior are defined
- [x] Authorization, masked-email, privacy, accessibility, responsive, error, and read-only boundaries are defined
- [x] Success criteria are measurable and technology-agnostic

### Group Readiness

- [x] `FR-001` through `FR-025` are sequential
- [x] `AC-001` through `AC-011` are sequential
- [x] `SC-001` through `SC-009` are sequential
- [x] Group 1 interaction tests are required to leave all business state unchanged

## Group 2 — Business Verification Approval

**Specification**: [Group 2](../spec-group-2-business-verification-approval.md)

### Content Quality

- [x] No implementation details such as languages, frameworks, or APIs
- [x] Focused on human verification, applicant outcomes, and business trust
- [x] Written for product, operations, security, and engineering stakeholders
- [x] User stories, UI states, data model, edge cases, acceptance criteria, and measurable outcomes are complete

### Requirement Completeness

- [x] No unresolved clarification markers or template placeholders remain
- [x] Review queue fields, filters, ordering, pagination, and historical inspection are exact
- [x] Application detail fields and protected viewer states are exact
- [x] Shared Candidate/Admin field names and lifecycle states are documented
- [x] Approve and Reject are the only Group 2 decisions
- [x] New-company and existing-company authority outcomes are deterministic
- [x] Rejection category, required reason, private note, evidence deletion, and Reapply behavior are defined
- [x] Stale/concurrent decisions, evidence outages, audit, notifications, privacy, accessibility, and performance are defined
- [x] Success criteria are measurable and technology-agnostic

### Cross-Module Consistency

- [x] `recruiter_id`, `company_name`, `tax_code`, `license_file_url`, `status`, `admin_comment`, `reviewed_by`, and `reviewed_at` are retained
- [x] PENDING_CHECKS, PENDING_REVIEW, CHANGES_REQUESTED, RESUBMITTED, APPROVED, REJECTED, CANCELLED, and EXPIRED are retained
- [x] REJECTED is terminal and Reapply creates a new PENDING_CHECKS request
- [x] Approval preserves Candidate identity and grants company-scoped membership authority
- [x] CHANGES_REQUESTED and RESUBMITTED are compatibility states, not new Group 2 actions

### Group Readiness

- [x] `G2-FR-001` through `G2-FR-031` are sequential
- [x] `G2-AC-001` through `G2-AC-013` are sequential
- [x] `G2-SC-001` through `G2-SC-012` are sequential
- [x] Authorization, evidence safety, privacy, state correctness, and deletion deadlines are 100% gates

## Group 3 — Account Suspension & Restoration

**Specification**: [Group 3](../spec-group-3-account-suspension-restoration.md)

### Content Quality

- [x] No implementation details such as languages, frameworks, or APIs
- [x] Focused on reversible human-controlled account enforcement
- [x] Written for product, operations, security, and engineering stakeholders
- [x] User stories, UI states, data model, edge cases, acceptance criteria, and measurable outcomes are complete

### Requirement Completeness

- [x] No unresolved clarification markers or template placeholders remain
- [x] ACTIVE-to-SUSPENDED and SUSPENDED-to-ACTIVE transitions are exact
- [x] Required category, protected rationale, confirmation, and step-up rules are defined
- [x] Candidate, Recruiter, authentication, membership, application, posting, and public-browsing effects are defined
- [x] Suspension preserves data and does not silently moderate content
- [x] Restoration requires a new login and does not restore restricted memberships or moderated content
- [x] Current-Platform-Administrator targeting, stale, retry, concurrency, and in-flight safeguards are defined
- [x] Audit fields, rationale privacy/retention, mandatory security-email content/retries, no-in-app boundary, and manual intervention are defined
- [x] Accessibility, focus, responsive, privacy, performance, and usability outcomes are defined
- [x] Success criteria are measurable and technology-agnostic

### Cross-Group Consistency

- [x] Group 3 uses the same authoritative UserAccount state displayed by Group 1
- [x] Account suspension is separate from company-membership suspension
- [x] Recruiter authority records are preserved but ineffective while the account is SUSPENDED
- [x] Posting visibility follows posting/company/moderation state rather than author suspension alone
- [x] No application stage or Candidate score changes automatically
- [x] Authorized recruiters may continue processing existing applications while the suspended Candidate remains unable to act
- [x] Account suspension pauses verification decisions without changing verification state or resetting deadlines

### Group Readiness

- [x] `G3-FR-001` through `G3-FR-030` are sequential
- [x] `G3-AC-001` through `G3-AC-012` are sequential
- [x] `G3-SC-001` through `G3-SC-011` are sequential
- [x] Authorization, session invalidation, privacy, audit, integrity, and retention deadlines are 100% gates

## Overall Feature Readiness

- [x] Each group can be reviewed independently without reading another group's full specification
- [x] Dependencies and assumptions are identified in every group
- [x] Scope is bounded and implementation output is excluded
- [x] No group introduces AI or automated authority/enforcement decisions
- [x] All three specifications conform to the SmartHire constitution
- [x] The feature is planned and ready for implementation review

## Notes

- Group 1 was validated in two review passes before Groups 2 and 3 were written.
- Group 2 passed its independent quality gate before Group 3 was started.
- Group 3 passed its independent quality gate after Group 2 completed.
- The existence of all three speckits does not authorize implementation.
- No unresolved clarification marker remains.
