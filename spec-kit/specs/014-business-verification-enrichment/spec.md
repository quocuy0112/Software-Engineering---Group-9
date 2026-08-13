# Feature Specification: Business Verification Enrichment

**Feature Branch**: `014-business-verification-enrichment`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Enrich the existing employer-verification workflow with public no-cost business-registry lookup, normalized business facts, verified company email, validated phone and website, applicant relationship proof, explicit consent, field-level validation, and toast feedback. Process all data before persistence, synchronize affected prior speckits, commit each Spec Kit phase, and do not push."

## Clarifications

### Session 2026-08-14

- Q: Should a registry lookup result automatically approve or reject an applicant? → A: No. Registry information is supporting evidence only; an authorized administrator remains the sole decision maker.
- Q: Should unavailable or rate-limited public lookup providers prevent submission? → A: No. The applicant may continue with normalized manual facts, while the request records an unavailable or unconfirmed registry result for administrator review.
- Q: When must company-email verification occur? → A: Before the authoritative verification request and business-license evidence are accepted, using a short-lived single-use link bound to the applicant, normalized tax identifier, and normalized email.
- Q: Does a syntactically valid company phone become verified? → A: No. It is normalized to Vietnamese international format and explicitly remains unverified because Feature 014 adds no OTP flow.
- Q: Which tax identifiers are supported? → A: Exactly ten ASCII digits for Vietnamese enterprises. Thirteen-digit branch and dependent-unit identifiers remain out of scope until the company model represents parent/dependent entities.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirm Registered Business Facts (Priority: P1)

As a Candidate applying for recruiter authority, I want to enter a tax identifier first and see available registered business facts so that I avoid retyping legal information and can detect a wrong identifier before uploading evidence.

**Why this priority**: The tax identifier is the existing company-matching boundary. Enriching it first reduces applicant error and gives administrators traceable third-party context without changing human decision authority.

**Independent Test**: Enter a valid, unknown, malformed, rate-limited, and unavailable-provider tax identifier; verify normalized lookup, public-data display, safe fallback, no automatic decision, and no persistence of unprocessed input.

**Acceptance Scenarios**:

1. **Given** an authenticated Candidate enters an exact ten-digit identifier and the configured public registry source returns a business, **When** lookup completes, **Then** legal name, registered address, establishment date when available, legal status, and entity type are displayed as source-provided read-only facts with source and checked time.
2. **Given** the source returns no business, **When** lookup completes, **Then** the applicant sees a non-blocking warning, may enter legal name and registered address manually, and the eventual request is visibly marked registry-unconfirmed for administrator review.
3. **Given** the source is unavailable, times out, or rate-limits the application, **When** lookup cannot complete, **Then** the applicant sees a retryable toast, may continue manually, and the failure neither approves nor rejects the application.
4. **Given** the applicant changes the tax identifier after a successful lookup, **When** the field changes, **Then** all previously displayed registry facts, contact verification, and lookup reference are invalidated before submission.
5. **Given** source facts differ from applicant-provided legal or operating facts, **When** the applicant continues, **Then** a 20–500-character mismatch explanation becomes mandatory and both normalized value sets remain available to the administrator.

---

### User Story 2 - Prove a Reachable Company Contact (Priority: P1)

As an applicant, I want to verify the company email used for the application and provide validated contact details so that the administrator can distinguish reachable business contact information from unverified claims.

**Why this priority**: Contact verification reduces accidental and disposable submissions but must not be confused with proof of authority over the company.

**Independent Test**: Exercise valid, malformed, free-provider, domain-matching, expired-token, reused-token, changed-email, resend, and delivery-failure cases while verifying that no business evidence is accepted before email verification.

**Acceptance Scenarios**:

1. **Given** normalized business facts, **When** the applicant enters a valid company email and requests verification, **Then** one short-lived single-use verification message is queued without revealing whether another account used that address.
2. **Given** the applicant opens a valid verification link in an authenticated session for the same account, tax identifier, and email, **When** verification succeeds, **Then** the contact is marked verified and may be used for one final application submission during its validity window.
3. **Given** an expired, consumed, mismatched, or superseded token, **When** verification is attempted, **Then** no contact becomes verified and the applicant receives a generic actionable error.
4. **Given** the applicant changes the email or tax identifier, **When** the change is accepted, **Then** prior verification becomes unusable and a new verification is required.
5. **Given** a syntactically valid email from a free provider or a domain different from the optional company website, **When** it is verified, **Then** submission remains possible but the admin detail shows the non-decisive trust signal.
6. **Given** a Vietnamese phone number in a supported local or international form, **When** it is accepted, **Then** it is stored in canonical `+84` form and displayed as `Unverified phone`; malformed, premium-rate, extension-bearing, or non-Vietnamese values are rejected inline.
7. **Given** an optional website, **When** it is accepted, **Then** it is normalized to an HTTPS origin without credentials, query, fragment, or deceptive host syntax.

---

### User Story 3 - Declare Relationship and Submit Evidence (Priority: P1)

As an applicant, I want to state my role and relationship to the company, provide required declarations, and submit the business license so that the application contains sufficient context for human review.

**Why this priority**: Company facts and contact access do not prove that the applicant may recruit for the company. Relationship context is required at the trust boundary.

**Independent Test**: Submit every relationship type with valid and invalid titles, conditional mismatch/relationship explanations, declarations, verified and unverified email, normalized contacts, and supported/unsupported evidence.

**Acceptance Scenarios**:

1. **Given** a verified company email, **When** the applicant selects Legal owner, Authorized employee, Invited member, Existing-owner approval, or Other, **Then** the relationship and a 2–120-character current job title are required and normalized before persistence.
2. **Given** Authorized employee or Other is selected, **When** the form is submitted, **Then** a 20–500-character authority explanation is required; the explanation supports review but never bypasses the existing invitation or OWNER-approval prerequisite for an existing company.
3. **Given** all required facts are valid, **When** the applicant accepts the accuracy declaration and document-processing consent and uploads a supported 1–5,000,000-byte license, **Then** one existing-lifecycle request is transactionally created in `PENDING_CHECKS` with the enriched facts and traceable lookup snapshot.
4. **Given** any field is invalid, **When** submission is attempted, **Then** no request or evidence is accepted, focus moves to the first invalid field, each invalid field has specific text, and a summary toast announces that corrections are required.
5. **Given** a network, provider, storage, or server failure, **When** an operation fails, **Then** a non-sensitive toast identifies a retryable failure, entered non-file values remain available, and duplicate requests are not created by retry.

---

### User Story 4 - Review Enriched Verification Context (Priority: P1)

As a Platform Administrator, I want registry, applicant, contact, relationship, and mismatch facts shown together so that I can review efficiently without searching public websites for routine comparisons.

**Why this priority**: Enrichment has no trust value unless administrators can distinguish source facts, applicant claims, verified contact control, and unverified signals at decision time.

**Independent Test**: Review matched, mismatched, unavailable-source, free-email, domain-mismatch, unverified-phone, existing-company, and stale-snapshot requests; verify display, protected access, audit, and unchanged human decision gates.

**Acceptance Scenarios**:

1. **Given** an authorized administrator opens a request, **When** detail loads, **Then** it separately labels applicant claims, registry facts, source/check time, field differences, email-verification time, email-domain signals, unverified phone, website, relationship, title, explanations, and consent time.
2. **Given** registry facts are missing, stale, or provider-unavailable, **When** detail loads, **Then** the limitation is visible and no company field is silently presented as registry-confirmed.
3. **Given** all enriched facts appear credible, **When** the administrator reviews them, **Then** no lookup, email-domain, phone, or website signal can automatically invoke approval, rejection, membership creation, or evidence qualification.
4. **Given** an existing-company application lacks the exact valid invitation or request-bound OWNER approval, **When** approval is attempted, **Then** the existing Feature 006 relationship prerequisite still blocks approval regardless of enriched facts.

### Edge Cases

- A tax identifier starts with zero; its exact ten-character sequence is retained.
- The registry returns malformed, oversized, missing, or unexpected fields; only allowlisted bounded fields are accepted and the lookup is treated as unavailable or partial.
- Registry facts change between initial lookup and administrator decision; the immutable submission snapshot remains visible and the admin can see its age rather than receiving silently replaced facts.
- Unicode company, address, title, and explanation inputs contain control characters, bidirectional controls, markup, repeated whitespace, or confusable punctuation; unsafe controls and markup are removed and bounded normalized plain text is stored.
- Email delivery is delayed or fails after the challenge commits; resend uses rate limits and idempotency without creating multiple valid challenges.
- A verification link is opened signed out or by another account; it reveals no applicant or company details and requires the intended authenticated account.
- A website uses an IP literal, localhost, credentials, non-HTTPS scheme, deceptive Unicode host, or excessive redirect syntax; it is rejected.
- Browser refresh or narrow-screen use occurs mid-form; non-file progress is recoverable without persisting secrets or verification tokens in browser storage.
- The public API changes terms, requires payment, or stops being public; the adapter is disabled and manual submission remains available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Feature 014 MUST extend, not replace, the Feature 006 recruiter-verification lifecycle, protected evidence rules, administrator authority, relationship prerequisite, audit, notification, and company-membership transaction.
- **FR-002**: Only authenticated active Candidate accounts on the Candidate origin MAY use lookup, contact verification, and enriched submission endpoints; all authorization MUST be re-evaluated server-side for every command.
- **FR-003**: Lookup MUST accept only a trimmed sequence of exactly ten ASCII digits and MUST NOT send malformed identifiers to an external source.
- **FR-004**: The system MUST integrate only through a provider-independent business-registry boundary whose enabled provider is publicly accessible without a paid subscription for the implemented use; no client secret or provider credential may reach the browser.
- **FR-005**: Lookup MUST use bounded timeouts, per-account and per-identifier rate limits, bounded cache freshness, response-size limits, allowlisted response fields, and safe failure mapping.
- **FR-006**: A lookup MUST produce an immutable bounded snapshot containing provider identifier, outcome, normalized tax identifier, accepted registry facts, checked time, expiry time, and a digest suitable for detecting accidental mutation; raw provider bodies MUST NOT be persisted or logged.
- **FR-007**: Registry legal name, registered address, establishment date, legal status, entity type, and representative name MAY be accepted only when supplied by the provider; representative name is administrator-only and MUST NOT be required from applicants.
- **FR-008**: Registry data MUST be supporting evidence only. It MUST NOT automatically approve, reject, qualify evidence, grant membership, or bypass a relationship prerequisite.
- **FR-009**: Provider not-found, timeout, rate limit, invalid-response, and unavailable outcomes MUST allow normalized manual legal name and registered address submission with a visible registry-unconfirmed limitation.
- **FR-010**: Applicant legal name, registered address, and optional operating address MUST be normalized bounded plain text before persistence; operating address is collected only when the applicant declares it differs from the registered address.
- **FR-011**: A 20–500-character normalized mismatch explanation MUST be required when the applicant overrides or materially differs from available registry legal name or registered address.
- **FR-012**: Company email MUST be normalized, syntax validated, length bounded, and verified by a short-lived single-use challenge before final request submission.
- **FR-013**: An email challenge MUST be bound to applicant account, normalized tax identifier, normalized email, and lookup snapshot; changing any binding value MUST supersede the challenge.
- **FR-014**: Verification tokens MUST be random, stored only as secure digests, excluded from logs and analytics, single-use, and expire after 24 hours; resend MUST invalidate earlier unconsumed challenges and apply bounded rate limits.
- **FR-015**: Email verification proves control of one mailbox only. Free-provider and website-domain-match signals MAY be displayed but MUST NOT independently permit or deny submission or administrator decision.
- **FR-016**: Company phone MUST be required, normalize supported Vietnamese local forms to canonical `+84` E.164 form, reject unsupported or ambiguous forms, and always be labelled unverified because this feature performs no OTP verification.
- **FR-017**: Optional company website MUST normalize to an HTTPS origin using an internationalized-domain-safe ASCII host and MUST reject credentials, query, fragment, IP literals, localhost/private hosts, unsupported ports, and non-web schemes.
- **FR-018**: Applicant relationship MUST be one of `LEGAL_OWNER`, `AUTHORIZED_EMPLOYEE`, `INVITED_MEMBER`, `EXISTING_OWNER_APPROVAL`, or `OTHER`; current job title is mandatory for every relationship.
- **FR-019**: `AUTHORIZED_EMPLOYEE` and `OTHER` MUST require a 20–500-character normalized authority explanation; no relationship declaration replaces Feature 006 invitation or OWNER approval for existing-company authority.
- **FR-020**: Requested recruiter role MUST remain constrained by existing Feature 006 new-company and existing-company rules; a new company approval grants OWNER regardless of a client-supplied role.
- **FR-021**: Accuracy declaration and business-document processing consent MUST both be explicit, unchecked by default, timestamped on accepted submission, and versioned by policy text version.
- **FR-022**: Business-license type, byte-size, quarantine, safety checking, protected access, supersession, and deletion MUST continue to satisfy Feature 006 FR-025 through FR-028.
- **FR-023**: Every string MUST be trimmed, Unicode-normalized, stripped of markup and unsafe control characters, whitespace-collapsed where semantically appropriate, length-bounded, and schema-validated before any authoritative persistence.
- **FR-024**: Canonical and source forms MUST be stored only when comparison or audit requires both; raw form bodies, raw provider responses, verification tokens, and redundant sensitive values MUST NOT be persisted.
- **FR-025**: Final submission MUST transactionally bind the current applicant, unexpired lookup snapshot, current verified email challenge, normalized contacts, relationship facts, consent, request, evidence metadata, and exactly one receipt notification; partial authoritative state MUST NOT remain after failure.
- **FR-026**: Retry, double-click, refresh, and concurrent final submission MUST produce at most one active request and one receipt notification for the applicant and normalized tax identifier.
- **FR-027**: Candidate UI MUST use field-level errors associated with inputs plus a non-color summary toast for validation failures; lookup, email, upload, and command success/failure MUST use accessible toast announcements without exposing internal codes.
- **FR-028**: Candidate UI MUST preserve normalized non-file progress across recoverable component or network failure without storing verification tokens, document bytes, or sensitive server responses in localStorage or sessionStorage.
- **FR-029**: Administrator queue/detail projections MUST expose bounded enriched review fields and difference indicators only after current admin authorization; public and applicant projections MUST not expose provider internals or administrator-only representative information.
- **FR-030**: Administrator detail MUST show snapshot source and age, applicant versus registry values, mismatch explanation, email verification and domain signals, unverified phone label, website, relationship, title, authority explanation, and consent policy/time.
- **FR-031**: Decision commands MUST re-evaluate applicant account eligibility, request version/state, evidence qualification/accessibility, existing-company relationship prerequisite, and required enriched facts; stale lookup age MAY warn but MUST NOT silently mutate submitted facts.
- **FR-032**: Lookup and email events MUST create privacy-safe operational records sufficient to diagnose outcome, provider, latency class, and retry behavior without recording email tokens, raw responses, full evidence, or unnecessary contact data.
- **FR-033**: Existing applicant receipt, change, approval, rejection, cancellation, delay, and expiry notifications MUST remain idempotent and MUST NOT disclose registry representative, internal lookup failures, evidence locators, admin identity, or private notes.
- **FR-034**: Feature 014 MUST provide deterministic manual fallback whenever the external public lookup is disabled or unavailable; lookup availability MUST NOT be an authorization dependency.
- **FR-035**: The implementation MUST document and test how the public provider can be disabled or replaced if it becomes paid, non-public, incompatible, or unavailable.
- **FR-036**: Feature 006 documentation MUST identify Feature 014 as the owner of enriched Candidate business facts and contact verification, and Feature 009 Group 2 MUST replace its old Candidate-side field assumption with the Feature 014 contract while preserving its planned admin decision scope.
- **FR-037**: The existing Feature 007 header status projection MUST remain read-only and MUST not transfer enriched application facts or own lookup/contact progress.

### Key Entities

- **Business Registry Lookup Snapshot**: Immutable, applicant-bound result of one normalized tax-identifier lookup, containing only allowlisted registry facts, provider/outcome, timestamps, and digest.
- **Company Contact Email Challenge**: Single-use, expiring proof that the current applicant controlled a normalized company email for one tax identifier and lookup snapshot; stores a token digest rather than a token.
- **Verification Business Facts**: One-to-one enriched facts attached to an accepted recruiter-verification request, separating registry facts, applicant claims, normalized contact values, relationship context, mismatch explanations, and consent metadata.
- **Recruiter Verification Request**: Existing Feature 006 lifecycle authority; Feature 014 adds a required relationship to enriched facts but does not redefine its state machine.
- **Business License Evidence**: Existing private, versioned, safety-checked evidence owned by Feature 006.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of 20 representative applicants complete tax lookup, company-email verification, and final submission without facilitator help; at least 10 participants use a narrow-screen layout.
- **SC-002**: In 100% of malformed-field tests, no unprocessed value reaches authoritative persistence and every rejected field receives specific accessible text plus one summary toast.
- **SC-003**: In 100% of provider timeout, rate-limit, malformed-response, not-found, and disabled-provider tests, manual fallback remains available and no automatic decision or authority grant occurs.
- **SC-004**: Lookup feedback becomes usable within 3 seconds at P95 across 200 measurements under documented normal public-provider conditions; timeout fallback becomes usable within 6 seconds at P95.
- **SC-005**: Email challenge request and verification confirmation each become usable within 2 seconds at P95 excluding external mail-delivery time, with no more than 1% unplanned errors across 200 measurements.
- **SC-006**: In 100% of token expiry, replay, wrong-account, changed-email, changed-tax-ID, resend, and concurrent-consume tests, at most one current binding becomes verified and no token or contact detail is disclosed.
- **SC-007**: In 100% of retry and concurrency tests, one applicant and tax identifier produce at most one active request, one current evidence version, and one receipt notification.
- **SC-008**: Administrator detail shows every required source, applicant, contact, relationship, mismatch, and consent field for 100% of representative matched, partial, manual, and unavailable-source fixtures.
- **SC-009**: Automated privacy checks find zero raw provider bodies, verification tokens, reusable evidence capabilities, storage locators, or unnecessary registry personal data in public URLs, browser-persistent storage, ordinary logs, analytics, applicant notifications, or audit context.
- **SC-010**: All Candidate and administrator tasks are keyboard-completable with visible focus, descriptive labels, non-color status text, toast live announcements, and zero serious or critical automated accessibility violations.

## Assumptions

- The initial free public lookup provider returns at most tax identifier, legal name, optional international/short name, and registered address. Establishment date, legal status, entity type, and representative are optional facts and remain visibly unavailable when the provider does not supply them.
- Public provider data may be stale or incomplete and is not an official SmartHire determination.
- Company email verification uses the existing durable email outbox and worker; mail delivery cannot roll back an accepted challenge or final request.
- Applicants may use a free email provider. Verification proves mailbox control, while the administrator evaluates authority using the full request and existing relationship prerequisites.
- Feature 014 supports Vietnamese enterprise tax identifiers of exactly ten ASCII digits only.
- Existing Feature 006 evidence retention and verification lifecycle remain authoritative.
- Feature 009 remains planned; synchronization changes its assumptions and dependencies, not its implementation status.

## Dependencies

- Feature 006 Candidate employer-verification routes, lifecycle, protected evidence, admin review, audit, notification, and membership approval transaction.
- Feature 007 read-only recruiter header status and navigation to Employer Verification.
- Feature 009 Group 2 planned administrator review contract.
- Existing authenticated Candidate workspace, email outbox/worker, private evidence storage, admin worker, and toast system.
- At least one no-cost public business lookup provider behind a replaceable server boundary.

## Out of Scope

- Paid, contractual, private, scraped, CAPTCHA-bypassing, or credential-sharing registry sources.
- Automatic approval, rejection, risk scoring, AI legitimacy decisions, or tax-match-only authority.
- Phone OTP, SMS delivery, call verification, or claiming that a phone is verified.
- Thirteen-digit branch/dependent-unit tax identifiers and parent-company modeling.
- Bank-account verification, capital, revenue, employee count, social profiles, logo, representative identity documents, or full business-industry lists.
- Applicant editing of an accepted request; corrections continue through the existing request-changes/resubmission lifecycle.
- Replacing Feature 006 protected evidence or Feature 009 administrator decision requirements.
