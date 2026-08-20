# Feature Specification: Company Administration Overview

**Feature Branch**: `UI_update`

**Created**: 2026-08-18

**Status**: Implemented

**Input**: Give platform administrators a secure, useful company overview without introducing company-management commands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect a company safely (Priority: P1)

A platform administrator opens a company from the administration list and sees its identity, verification state, membership health, recent membership changes, verification summary, and recruitment activity in one page.

**Why this priority**: The administrator must be able to identify operational and access risks before taking a separate privileged action.

**Independent Test**: An authorized administrator opens a known company and receives the complete overview; an unknown company is unavailable.

**Acceptance Scenarios**:

1. **Given** an authorized administrator and an existing company, **When** the administrator opens its detail page, **Then** the page displays the defined summary without requiring multiple sequential requests.
2. **Given** a company with zero or one active owner, **When** its detail page opens, **Then** the page displays a distinct owner-risk warning.
3. **Given** an unknown company reference, **When** the administrator opens its detail page, **Then** the page shows the established unavailable state.

---

### User Story 2 - Find companies reliably (Priority: P2)

A platform administrator searches the company list by company name or reference and opens the matching company detail page.

**Why this priority**: The overview is only useful when administrators can find the correct company quickly.

**Independent Test**: A search by company name or ID returns matching rows with a visible legal name, display name, and verification state.

## Edge Cases

- Companies with no memberships are displayed with a high-severity warning and no invented owner data.
- Companies with no verification requests or job activity display an explicit empty state.
- View access must not expose documents, full tax identifiers, email addresses, or private notes.
- A failed audit write makes the detail request fail rather than silently returning sensitive data without the required access record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an authorized administrator a single company overview containing the defined, least-privilege summaries.
- **FR-002**: The system MUST show a clear warning for zero active owners and a distinct warning for exactly one active owner.
- **FR-003**: The system MUST record every successful company-detail view with actor, session, action, target, result, and timestamp, without including unnecessary personal data.
- **FR-004**: The system MUST return the same established unavailable response for a missing company and never render partial company data.
- **FR-005**: The company list MUST provide an always-visible search by legal/display name or company reference, plus verification-status and created-date filters, and show fields returned by the system.
- **FR-006**: The overview MUST NOT introduce suspend, reinstate, ownership-transfer, membership-removal, or verification-override commands.

### Key Entities

- **Company overview**: A read-only operational projection of one existing company and its safe summaries.
- **Company membership summary**: Counts, active-owner health, and a bounded recent-change projection.
- **Company access audit event**: An immutable record that an administrator viewed a company overview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized administrator can identify company verification, membership-owner health, and recruitment activity from one detail page in under 30 seconds.
- **SC-002**: 100% of successful company-detail views create an audit record with the required safe fields.
- **SC-003**: The detail page displays owner-risk feedback for every company with zero or one active owner.
- **SC-004**: Under a representative administrative dataset, 95% of company overview requests complete within 3 seconds.

## Assumptions

- Existing platform-administrator session and step-up authority are reused.
- Company actions remain out of scope for this feature; existing membership workflows remain their own command owners.
- Full history and related-resource lists remain follow-up work and are not embedded in the overview response.
