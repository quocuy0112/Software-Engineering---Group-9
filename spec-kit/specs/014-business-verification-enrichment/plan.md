# Implementation Plan: Business Verification Enrichment

**Branch**: `014-business-verification-enrichment` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/014-business-verification-enrichment/spec.md`

## Summary

Feature 014 enriches the existing Feature 006 employer-verification workflow without replacing its lifecycle, evidence processing, administrator decision, or membership transaction. Candidates first look up a ten-digit Vietnamese enterprise tax identifier through a replaceable server-side gateway, verify control of a company email through the existing durable email outbox, provide normalized contact and relationship facts, explicitly consent, and submit the existing protected business-license evidence. VietQR is the initial public no-cost lookup adapter and supplies only legal name and registered address today; missing registry fields remain visibly unavailable and provider failure always falls back to manual entry. Accepted enriched facts are copied into an immutable request-owned record for administrator comparison.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24.18.0

**Primary Dependencies**: Next.js 16.3 App Router Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, Better Auth 1.6, Sonner 2.0, existing email outbox and evidence storage

**Storage**: PostgreSQL remains authoritative for preparation state, lookup snapshots, email challenges, request facts, lifecycle state, audit, and outbox metadata; existing private filesystem/S3 adapters remain authoritative for encrypted evidence bytes

**Testing**: Vitest 4.1, Testing Library, OpenAPI parity, Prisma/PostgreSQL transaction and concurrency tests, mocked provider contract tests, privacy/security/architecture tests, focused accessibility tests, and representative performance scripts

**Target Platform**: Existing Windows/Linux Next.js deployment, responsive Candidate workspace, administrator console, and modern browsers

**Project Type**: Modular full-stack application in the existing `web/` workspace

**Performance Goals**: Lookup feedback P95 within 3 seconds under normal provider conditions and fallback P95 within 6 seconds; preparation/email commands P95 within 2 seconds excluding delivery; page/navigation remain within constitution targets

**Constraints**: Public no-cost provider only; no scraping or CAPTCHA bypass; ten-digit enterprise tax identifiers only; provider response is non-decisive; all accepted strings normalize before persistence; single-use 24-hour email proof; no phone OTP; exactly one active request and receipt; no secrets, raw provider bodies, or tokens in logs/browser persistence

**Scale/Scope**: One Candidate preparation flow, four preparation/verification commands, enriched final submission, one additive migration, one provider adapter, one new email template, administrator detail enrichment, cleanup work, and focused tests

## Existing-System Reconciliation

`RecruiterVerificationRequest` remains the only lifecycle authority and retains `PENDING_CHECKS`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, `RESUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`, and `EXPIRED`. `BusinessLicenseEvidence`, the safety worker, protected viewer, decision service, approval transaction, notifications, and existing-company prerequisite remain owned by Feature 006.

Feature 014 adds a pre-submission preparation aggregate and one immutable business-facts record per newly accepted request. Legacy requests remain readable with `businessFacts = null`; administrators see a clear `legacyRequest` limitation. New final submissions require complete enriched facts at the service boundary. Feature 007 continues to consume only the existing read-only verification status projection. Feature 009 Group 2 consumes the enriched administrator projection but does not become the owner of Candidate input.

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Design evidence | Result |
|---|---|---:|
| I. Human-controlled recruitment | Registry, domain, phone, and website signals are labelled supporting evidence and cannot invoke decisions or membership changes. | PASS |
| II. Security/privacy/tenant isolation | Active Candidate authorization is server-side; tokens are digested; sensitive preparation data is no-store and applicant-bound; admin facts require current authority. | PASS |
| III. Deterministic core | Validation, normalization, mismatch rules, fallback, expiry, challenge consumption, and request uniqueness are deterministic and AI-free. | PASS |
| IV. State/audit/integrity | PostgreSQL owns preparation and request state; final acceptance is transactional; immutable snapshots and idempotency prevent duplicate authority. | PASS |
| V. Scope discipline | The feature extends the approved P0 verification workflow and excludes paid lookup, OTP, branch tax IDs, scoring, and automatic decisions. | PASS |
| VI. Quality/accessibility | Measured P95 targets, field errors, focus recovery, live toast feedback, responsive sections, and accessibility tests are defined. | PASS |
| VII. Maintainable architecture | App Router routes delegate to typed services/repositories; lookup and email providers remain replaceable; existing session/evidence boundaries are reused. | PASS |

**Post-design re-check**: PASS. The OpenAPI contract, additive migration, provider gateway, and request-owned facts preserve every mandatory boundary.

## Architecture and Ownership

```text
Candidate employer-verification page
  |-- GET/PATCH /api/employer-verifications/preparation
  |-- POST /api/employer-verifications/registry-lookups
  |-- POST /api/employer-verifications/company-email/challenges
  |-- POST /api/employer-verifications/company-email/confirm
  `-- POST /api/employer-verifications
          `-- EmployerVerificationPreparationService
                |-- BusinessRegistryLookupGateway
                |     `-- VietQrBusinessRegistryLookupAdapter
                |-- PrismaEmployerVerificationPreparationRepository
                |-- existing RateLimitBucket repository
                |-- existing EmailOutbox worker
                `-- ApplicantVerificationService
                      |-- existing evidence storage
                      |-- existing relationship prerequisite gateway
                      `-- Feature 006 request/evidence lifecycle

Administrator verification detail
  `-- existing verification service/repository
        `-- request.businessFacts + lookupSnapshot
```

- Route Handlers own Candidate-origin enforcement, content-length bounds, strict parsing, no-store responses, and safe HTTP errors.
- Shared Zod contracts own field normalization and typed request/response shapes. Services re-parse all input and never trust browser-normalized values.
- `EmployerVerificationPreparationService` owns lookup admission, provider mapping, mutable draft recovery, challenge issue/confirm/supersede, expiry, and cleanup policy.
- `ApplicantVerificationService` owns final cross-record checks and delegates existing company/evidence behavior unchanged.
- The final transaction consumes the verified challenge, marks the lookup accepted, creates request facts/evidence metadata/receipt, and clears mutable preparation state.
- Raw provider bodies, plaintext tokens, file bytes, and unnormalized form bodies are never persisted or written to ordinary logs.

## Public Provider Boundary

`BusinessRegistryLookupGateway.lookup(normalizedTaxIdentifier, signal)` returns one of `MATCHED`, `NOT_FOUND`, `PARTIAL`, or `UNAVAILABLE` plus allowlisted bounded facts. The initial adapter calls `GET https://api.vietqr.io/v2/business/{taxCode}` with a four-second abort deadline and a 64 KiB response cap. It accepts only `data.id`, `data.name`, `data.internationalName`, `data.shortName`, and `data.address`; current VietQR documentation does not supply establishment date, status, entity type, or representative, so those values remain null.

The adapter is enabled by `BUSINESS_REGISTRY_PROVIDER=vietqr`; `disabled` forces deterministic manual fallback. Network errors, timeout, HTTP 429/5xx, malformed JSON, oversized payload, identifier mismatch, or missing required matched fields map to safe unavailable/partial outcomes. The provider is never called from the browser and never becomes an authorization dependency.

Admission uses the existing PostgreSQL `RateLimitBucket`: 10 account lookups per 15 minutes and 30 identifier lookups per 15 minutes, plus 5 challenge sends per account/email binding per hour. Subject values are HMAC-digested before rate-limit persistence. Successful matched results may avoid another provider call for the same applicant and identifier for 15 minutes, while the immutable submission snapshot remains valid for 24 hours so the documented email-verification window is usable. Every returned preparation reference is an opaque server ID and responses are private/no-store.

## Preparation and Submission Flow

1. `GET preparation` restores the applicant's current normalized server-side draft, current safe registry projection, and masked company-email status. No token, provider raw body, or administrator-only representative fact is returned.
2. `POST registry-lookups` validates exactly ten ASCII digits, applies rate limits, calls or bypasses the configured gateway, creates an immutable 24-hour snapshot, replaces the current preparation binding, and supersedes prior email challenges.
3. `PATCH preparation` accepts allowlisted partial draft fields, normalizes each provided value, recomputes deterministic mismatch/domain/free-email signals, and stores only normalized values. Tax identifier and verified-email state cannot be patched.
4. `POST company-email/challenges` normalizes the email, binds a random 256-bit token digest to applicant + current snapshot + tax identifier + email, supersedes earlier active challenges, and transactionally queues one `COMPANY_EMAIL_VERIFY` outbox item. The email link targets the dedicated `/verify-company-email` landing page and places the raw token in the URL fragment so it is not sent in HTTP referrers or initial server requests.
5. The public landing page removes the fragment with `history.replaceState`, keeps the token only in component memory, and posts it to `company-email/confirm`. The service atomically verifies the digest, applicant, current binding, status, and expiry. A signed-out browser receives no business details and can open sign-in in a separate tab before retrying without persisting the token.
6. Final multipart submission revalidates every field, challenge age, snapshot expiry, current preparation version, evidence, company match, and prerequisite. `applicantLegalName` is the sole submitted legal-name input and is copied into the legacy `submittedCompanyName` request column for compatibility. It stores evidence through the existing adapter and then transactionally creates request facts, request, evidence metadata, one receipt, challenge consumption, and snapshot acceptance. Storage is deleted if the transaction fails.
7. The admin worker expires/scrubs/deletes unused preparation records according to Feature 014 retention deadlines. Accepted snapshots follow the owning request's authorized history lifetime.

## Normalization and Comparison

- Plain text uses the existing server plain-text normalizer with NFKC, markup/control removal, whitespace policy, and field-specific bounds.
- Tax identifiers retain their exact ten ASCII digits, including a leading zero.
- Email is trimmed, lower-cased for canonical comparison, syntax/length validated, and stored only in the protected preparation/challenge/facts records.
- Phone removes spaces, dots, hyphens, and parentheses, rejects extensions and non-Vietnamese country codes, then stores `+84` plus a 9- or 10-digit national number without local leading zero; `phoneVerified` is always false.
- Website parses through `URL`, accepts a public DNS hostname only, converts IDN to ASCII, strips `www.`, allows HTTPS/default port only, and stores `https://host`.
- Applicant legal name and registered address are compared to registry values after the same field-specific normalization. Any inequality requires a normalized 20-500 character mismatch explanation; no fuzzy threshold is used.
- Free-email and website-domain match are deterministic review signals only. The initial free-provider set is versioned code data and never blocks submission.

## Data and Migration Strategy

1. Add enums and additive tables for preparation, registry snapshots, email challenges, and immutable request facts; add optional relations from `UserAccount`, `RecruiterVerificationRequest`, and `EmailOutbox`.
2. Keep `RecruiterVerificationRequest.businessFacts` optional at the database layer so existing rows and rollback-safe deployments remain readable. Enforce required facts for new submissions in the service.
3. Add a PostgreSQL partial unique index for one active request per `(applicantUserId, normalizedTaxIdentifier)` across non-terminal states. Existing duplicates are detected by a pre-deploy verification script; migration does not silently delete data.
4. Add challenge uniqueness and indexes for current binding, token digest, expiry/scrubbing, preparation expiry, and accepted snapshot ownership.
5. Deploy schema/server code before exposing the new Candidate form. The server may run with `BUSINESS_REGISTRY_PROVIDER=disabled` and still accept manual preparation.
6. Rollback disables UI/routes/provider while retaining additive records. Recovery uses forward migrations; accepted facts and audit evidence are never destructively rolled back.

## Authorization, Privacy, and Audit

- The exclusive browser-session owner remains Better Auth with opaque database-backed cookies configured by the existing auth boundary. Feature 014 creates no second session or browser credential.
- Candidate routes require the current active account on the Candidate origin. IDs are always re-bound to `session.userId`; unknown, expired, and cross-account references return the same safe unavailable code.
- Preparation responses use `Cache-Control: private, no-store`. Tokens are accepted only in POST bodies, redacted from telemetry, stored as digests, and scrubbed immediately on terminal challenge states.
- Operational audit events record actor digest/reference, action, safe outcome, provider key, latency class, and correlation ID. They exclude email, tax identifier plaintext, raw provider data, registry representative, evidence data/location, and token material.
- Administrator projections require the existing admin boundary. Representative data, if a future provider supplies it, is admin-only. Existing notification payloads remain bounded and do not gain enriched sensitive fields.

## Candidate and Administrator UI

The Candidate page becomes four responsive sections: registered business, company contact, applicant authority, and evidence/declarations. Tax lookup precedes the remaining sections. Registry values are labelled read-only source facts; fallback and limitations use text plus icons, never color alone. Inline errors use `aria-describedby`; failed validation focuses the first invalid control and emits one Sonner summary toast. Async actions have stable toast IDs, disabled duplicate controls, visible progress, and actionable retry copy.

The administrator detail adds a bounded comparison panel showing source/outcome/age, registry versus applicant values, explicit differences, email verification/domain signals, unverified phone, website, relationship/title/explanations, and consent version/time. No signal changes the existing approve/reject controls or server decision gates.

## Project Structure

### Documentation

```text
spec-kit/specs/014-business-verification-enrichment/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/openapi.yaml
`-- tasks.md
```

### Source Code

```text
web/
|-- prisma/{schema.prisma,migrations/*_business_verification_enrichment/}
|-- scripts/verify-business-verification-enrichment-migration.mjs
|-- src/app/api/employer-verifications/**
|-- src/backend/admin/verification/**
|-- src/backend/business-registry/**
|-- src/backend/email/templates/company-email-verification.tsx
|-- src/backend/repositories/employer-verification/**
|-- src/frontend/features/employer-verification/**
|-- src/frontend/features/admin/verification/**
|-- src/shared/contracts/employer-verification/**
`-- tests/{shared,backend,frontend,security,architecture,performance}/**
```

**Structure Decision**: Extend the existing Feature 006 route/service/evidence/admin boundaries. Add a narrow provider module and preparation repository rather than placing external calls or mutable draft logic in the route or lifecycle repository.

## Verification Strategy

- Shared/unit tests cover every normalizer, conditional schema, deterministic mismatch/domain signal, token digest, provider mapping, response cap, timeout, and safe errors.
- Contract tests validate Zod/OpenAPI parity, candidate-origin/auth checks, no-store headers, fragment-token confirmation contract, field errors, and bounded projections.
- Integration tests prove lookup/challenge ownership, resend supersession, expiry/replay/wrong-account denial, autosave recovery, final atomicity, evidence cleanup, request uniqueness, receipt uniqueness, legacy request compatibility, and cleanup deadlines.
- Provider tests use deterministic mocked HTTP responses only; CI never depends on VietQR availability. One optional manual smoke check is documented separately.
- Frontend tests cover matched/manual/unavailable flows, invalid fields, focus and toast behavior, narrow screens, refresh recovery, token-fragment removal, duplicate actions, and administrator comparison rendering.
- Security/architecture tests prove no raw provider body/token/storage locator in logs, URLs, browser persistence, applicant responses, notifications, or audit context and prevent direct provider imports outside the adapter composition root.
- Performance scripts document environment, dataset, sample size, warm-up, concurrency, P50/P95/P99/max, external condition, and error rate for 200 lookup and challenge measurements.

## Complexity Tracking

No constitution violation or additional complexity waiver is required. Server-side preparation is retained because cross-refresh recovery and verified-email binding cannot be implemented safely with browser persistence alone.
