# Research: Business Verification Enrichment

## Decision 1: Extend Feature 006 rather than create a second lifecycle

**Decision**: Keep `RecruiterVerificationRequest` and its existing state machine as the sole employer-authority request.

**Rationale**: Feature 006 already owns evidence, checks, administrator decisions, notifications, prerequisites, company creation, and membership grants. A second request aggregate would create conflicting authority and duplicate state transitions.

**Alternatives considered**:
- Replace Feature 006: rejected because it would invalidate approved lifecycle, retention, and audit behavior.
- Create a separate pre-approval request: rejected because administrators would need to reconcile two sources of truth.

## Decision 2: Use VietQR as the initial public no-cost adapter

**Decision**: Implement a replaceable `BusinessRegistryLookupGateway` with an initial VietQR adapter for `GET https://api.vietqr.io/v2/business/{taxCode}`.

**Rationale**: VietQR publicly documents the endpoint without an API-key requirement and documents success and rate-limit responses. It returns tax identifier, legal name, international/short names, and registered address, which are useful supporting facts.

**Source**: [VietQR Tax ID Lookup API](https://vietqr.io/danh-sach-api/tax-id-lookup/), reviewed 2026-08-14.

**Limitations**: VietQR is operated by CASSO rather than being SmartHire's authoritative government registry. Its current documented response does not include establishment date, legal status, entity type, or representative. Those fields remain null and visibly unavailable. No decision depends on provider availability or correctness.

**Alternatives considered**:
- Scrape Vietnamese tax websites: rejected by the user's public-API-only requirement and operational/legal fragility.
- Require a paid commercial registry: rejected because Feature 014 permits only public no-cost sources.
- Remove lookup: rejected because a replaceable supporting lookup materially reduces applicant/admin retyping while manual fallback still protects availability.

## Decision 3: Keep lookup server-side and strictly bounded

**Decision**: Route all provider access through the backend with a four-second timeout, 64 KiB body cap, strict JSON schema, identifier equality check, and allowlisted fields.

**Rationale**: This hides provider composition, prevents browser abuse, centralizes rate limits, avoids persisting unexpected data, and produces stable safe outcomes despite provider changes.

**Alternatives considered**:
- Browser lookup: rejected because it exposes the provider boundary and bypasses server admission controls.
- Persist raw responses: rejected because they are unnecessary, mutable, and may later contain unexpected personal data.

## Decision 4: Treat registry data as immutable supporting evidence

**Decision**: Store an immutable bounded snapshot with provider key, outcome, accepted facts, checked/expiry times, and a canonical digest.

**Rationale**: Administrators must review the facts actually shown at submission time. Refreshing provider data in place would silently rewrite evidence and make decisions non-reproducible.

**Alternatives considered**:
- Live lookup on every admin view: rejected because results may change and provider downtime would block review.
- Copy only a match boolean: rejected because it cannot support transparent field comparison.

## Decision 5: Provide deterministic manual fallback

**Decision**: `NOT_FOUND`, `PARTIAL`, `UNAVAILABLE`, rate limit, timeout, malformed response, and disabled provider all allow manual legal name/address entry with a visible limitation.

**Rationale**: An external public service must not become an authorization dependency or prevent legitimate applications.

**Alternatives considered**:
- Block until provider recovers: rejected because availability and free-tier policies are outside SmartHire control.
- Treat not-found as rejection: rejected because the provider is non-authoritative and human review is mandatory.

## Decision 6: Persist recoverable preparation on the server

**Decision**: Maintain one mutable `EmployerVerificationPreparation` per applicant containing only normalized draft values and current snapshot/challenge references.

**Rationale**: The form must recover after refresh without storing tokens, provider payloads, evidence, or sensitive server responses in browser persistence. The server draft also supplies one authoritative binding/version for final submission.

**Alternatives considered**:
- `localStorage`/`sessionStorage`: rejected for contact and verification state because persistent browser data expands exposure and can drift from server truth.
- React state only: rejected because refresh loses progress.
- Store mutable applicant claims in the immutable lookup snapshot: rejected because it mixes source evidence with user edits.

## Decision 7: Reuse the durable email outbox

**Decision**: Add `COMPANY_EMAIL_VERIFY` to the existing outbox and worker, with one outbox item linked to each challenge.

**Rationale**: Existing delivery retry, leasing, safe errors, and provider independence already solve the infrastructure problem. Delivery failure must not corrupt challenge persistence.

**Alternatives considered**:
- Send synchronously in the route: rejected because provider latency/failure would couple transport to persistence.
- Reuse account email-verification tokens: rejected because company email proof has different binding, retention, and semantics.

## Decision 8: Use fragment links and POST confirmation

**Decision**: Email links use `/dashboard/employer-verification#company-email-token=<token>`. The client removes the fragment immediately and submits the token in a no-store POST body.

**Rationale**: URL fragments are not sent in the initial HTTP request or referrer, reducing token exposure in server access logs and RSC requests. POST confirmation allows strict body redaction and same-account session checks.

**Alternatives considered**:
- Query-string confirmation: rejected because tokens commonly appear in access logs, referrers, and copied URLs.
- Store token in browser storage: rejected because it creates a reusable persistent secret.

## Decision 9: Copy accepted facts into one request-owned record

**Decision**: Create one immutable `VerificationBusinessFacts` row per new request and retain the accepted lookup relation.

**Rationale**: Mutable preparation must not change accepted review evidence. One request-owned record gives the admin a stable projection and keeps the lifecycle request compact.

**Alternatives considered**:
- Read accepted values from the mutable preparation: rejected because later edits/cleanup could change historical review context.
- Add every field to `RecruiterVerificationRequest`: rejected because it bloats the lifecycle authority and mixes concerns.

## Decision 10: Normalize at shared contract and service boundaries

**Decision**: Use shared pure normalizers for UI feedback and server parsing, then re-run them in services before any persistence.

**Rationale**: Shared deterministic behavior improves feedback, while server repetition preserves the trust boundary. The existing plain-text normalizer is reused for Unicode/control/markup handling.

**Alternatives considered**:
- Client-only normalization: rejected because clients are untrusted.
- Database-only cleanup: rejected because field-level errors become opaque and malformed values reach an authoritative boundary.

## Decision 11: Use exact normalized mismatch detection

**Decision**: Any unequal normalized legal name or registered address requires an explanation; no fuzzy similarity threshold suppresses differences.

**Rationale**: Exact behavior is transparent, testable, and cannot disguise discrepancies. Human reviewers decide whether the difference is meaningful.

**Alternatives considered**:
- Fuzzy matching: rejected because threshold behavior can be opaque and language/address-specific.
- Disallow overrides: rejected because public provider data may be stale or malformed.

## Decision 12: Validate phone syntax without claiming verification

**Decision**: Accept only supported Vietnamese local/`+84` forms, canonicalize to `+84`, reject extensions/other countries, and persist `phoneVerified=false`.

**Rationale**: This improves data quality without adding SMS cost, OTP infrastructure, or a false trust claim.

## Decision 13: Normalize website to a safe HTTPS origin

**Decision**: Store only `https://ascii-host`, rejecting credentials, query, fragment, IP/localhost/private hosts, non-default ports, and deceptive host syntax.

**Rationale**: An origin is sufficient for deterministic domain comparison and avoids persisting tracking paths or unsafe URLs.

## Decision 14: Add an additive compatibility migration

**Decision**: Keep the new request-facts relation optional in PostgreSQL, require it for new submissions in service code, and show a legacy limitation for old requests.

**Rationale**: Existing requests cannot be truthfully backfilled with email proof or registry snapshots. Fabricated backfill would weaken audit integrity.

## Decision 15: Enforce active-request uniqueness in PostgreSQL

**Decision**: Add a partial unique index for non-terminal request states on applicant and tax identifier, with a pre-deploy duplicate detector.

**Rationale**: Application checks alone cannot prevent concurrent duplicate submissions. The database must preserve the invariant.

## Decision 16: Use versioned code data for free-email signals

**Decision**: Maintain a small reviewed set of common free-email domains in code and persist only the resulting boolean plus signal-version in accepted facts.

**Rationale**: The signal is explainable, deterministic, replaceable, and non-decisive. A third-party reputation service would violate the no-cost/public constraint and add privacy leakage.

## Decision 17: Separate operational telemetry from sensitive facts

**Decision**: Record only safe outcome/provider/latency-class/retry metadata in audit or telemetry; keep tax ID, email, registry values, token material, and provider bodies out.

**Rationale**: Operations can diagnose reliability without duplicating sensitive business/contact data into broad-access systems.
