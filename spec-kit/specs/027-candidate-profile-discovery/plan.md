# Implementation Plan: Candidate Profile Discovery and Recruiter Review

**Branch**: `027-candidate-profile-discovery` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

## Summary

Add consent-based professional profile discovery for Candidates and an application-scoped recruiter profile review. Candidate visibility is stored separately from editable profile data and projected per audience. Exact-ID lookup is throttled and neutralized. Recruiter review reuses application, document, and company/job authorization boundaries, presents immutable application evidence separately from permitted live information, and gates contact through revocable per-application consent.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Next.js 16 App Router, Prisma 7.9, PostgreSQL 16.  
**Primary Dependencies**: Better Auth session boundary, Zod, Prisma, existing CSRF/audit/network-source/rate-limit primitives.  
**Storage**: PostgreSQL profile and application tables plus existing immutable application documents/snapshots.  
**Testing**: Vitest unit/integration/contract/security/frontend/accessibility tests and Playwright end-to-end tests.  
**Target Platform**: Existing Candidate workspace, Connections, Profile workspace, and Recruiter candidate drawer/pipeline.  
**Project Type**: Next.js modular-monolith web application.  
**Performance Goals**: P95 exact-ID lookup and recruiter profile projection ≤2 seconds under representative normal load.  
**Constraints**: Server-side audience and tenant authorization; private no-store responses; no raw queried IDs/contact/profile contents in ordinary logs; 10 lookup attempts/minute and 30 unsuccessful/rolling hour for account and network; 15-minute block; default-hidden discovery; 12-month snapshot retention.  
**Scale/Scope**: At most one lookup result, one visibility record per candidate, one contact-consent record per submitted application; no public directory, name/email search, or recruiter discovery of non-applicants.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Security, privacy, tenant isolation | PASS | Default-deny projections; verified company/job authorization; no-store private data; minimal audit context. |
| State, audit, integrity | PASS | One-to-one visibility/consent records, versions, atomic throttle decisions, immutable snapshots, append-only audit events. |
| Human-controlled recruitment | PASS | No score, decision, or pipeline transition changes. |
| Quality and accessibility | PASS | P95 target, neutral errors, labelled keyboard workflows, focused security/a11y/E2E verification. |
| Maintainable boundaries | PASS | Route handlers use typed services/repositories and extend existing profile/application/authorization/audit primitives. |
| Scope discipline | PASS | No directory, discovery-based messaging, or non-applicant recruiter search. |

## Project Structure

```text
spec-kit/specs/027-candidate-profile-discovery/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/profile-discovery.openapi.yaml
└── tasks.md                         # generated later

web/
├── prisma/{schema.prisma,migrations/066_candidate_profile_discovery/migration.sql}
├── src/app/api/{account/profile,people/lookup,candidate/applications/[applicationId]/contact-consent,recruiter/jobs/[jobId]/applications/[applicationId]/profile}/route.ts
├── src/backend/{applications,audit,repositories/{applications,profile,rate-limit},security/{network-source,rate-limit},services/profile}/
├── src/frontend/features/{connections,profile,recruiter-applications}/
├── src/shared/contracts/{account,candidate-applications,applications,jobs}/
└── tests/{backend,frontend,security,system}/
```

## Design Decisions

1. **Audience-specific visibility, not duplicated profile content**: a one-to-one `CandidateProfileVisibility` record stores default-hidden discoverability and strict Candidate/Recruiter section sets; existing profile tables stay authoritative.
2. **Discovery is separate from messaging**: a profile access service performs discovery policy checks; a message action remains gated only by existing messaging eligibility.
3. **Recruiter review is application-scoped**: all reviewer reads use `{ jobId, applicationId }` and `RecruiterApplicationAuthorization.authorizeApplication`; no recruiter route accepts a candidate ID.
4. **Immutable snapshot, revocable live data**: returned recruiter data labels submitted snapshot and current live sections. Existing application documents/snapshots are reused; snapshot access expires after 12 months unless held.
5. **Application-owned contact consent**: current `contactSnapshot` may be projected only while its one-to-one consent is active. Apply this gate to all recruiter list, ranking, profile, preview, and document projections to close existing email/phone leakage.
6. **Durable throttle**: a purpose-built admission service extends HMAC-digested account/network rate limiting with unsuccessful-hour counts and `blockedUntil` enforcement; inaccessible targets produce one neutral result.
7. **Minimal audits**: strict audit actions record actor, target reference, outcome, policy/consent version, and throttle state—never raw IDs, profile bodies, or contact values.
