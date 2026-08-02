# Feature 003 US2 View Job Details Results

**Recorded**: 2026-08-02  
**Use case**: UC-JOB-02  
**Priority / release class**: P1 / Must  
**Result**: PASS for the independent focused automated slice

## Automated Evidence

One focused Vitest invocation covered public-detail state/action policy, the
`GET /api/jobs/{slug}` contract, detail rendering, and detail accessibility.

Result: **4 test files passed; 8 tests passed; 0 failed**.

## Behaviors Observed

- Active, closed, expired, and non-public outcomes are projected explicitly.
- Missing/private/pending/rejected/removed states use the neutral boundary.
- The public allowlist excludes moderation, recruiter-private, report,
  application, CV, and audit data.
- Apply/action availability, textual state, keyboard semantics, and narrow
  layouts are covered.

## Gate Conclusion

US2 is green as an independent detail slice. Production page-load and p95
qualification remain part of the cross-cutting performance/release gate.

---

## Requirements Dossier: US2: View Job Details

**Use case**: UC-JOB-02
**Priority**: P1
**Release class**: Must
**Primary actor**: Visitor or authenticated user
**Requirements**: FR-009 through FR-014, FR-031 through FR-035
**HTTP contract**: `GET /api/jobs/{slug}`

### Outcome

An actor can open a stable canonical URL for a currently or historically public
job, understand whether it still accepts applications, and see only actions
allowed by the current posting and actor state.

### Preconditions and Public States

- The slug is validated before repository access.
- `ACTIVE`, `CLOSED`, and `EXPIRED` historically public postings may have public
  detail projections with explicit textual state labels.
- Missing, removed, private, pending-review, and rejected postings share the
  same neutral unavailable outcome to prevent state disclosure.
- Optional session resolution may add only the current actor's saved/applied
  state; it never changes the approved public fields.

### Primary Flow

1. The actor follows a result link or opens `/jobs/{slug}` directly.
2. The detail service validates the slug and queries the explicit public
   projection using the current time and optional actor identity.
3. The service derives public state, `canApply`, `canSave`, `canReport`, and
   actor-scoped history without accepting an ownership identifier from input.
4. The page renders approved company/job sections, canonical metadata, textual
   availability, and only the allowed action entry points.
5. A protected action selected by a visitor uses a validated internal return
   destination; authorization and availability are checked again after login.

### Alternate and Failure Outcomes

| Condition                                     | Required outcome                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Closed or expired historical job              | Show public history and state; disable Apply.                          |
| Missing/private/pending/rejected/removed slug | Return the same neutral unavailable response.                          |
| Expired or revoked optional session           | Render anonymous projection; leak no account state.                    |
| Saved/applied state lookup fails              | Do not expose another actor; use safe page recovery/no-store behavior. |
| Repository failure                            | Return a canonical safe retry outcome without internals.               |

### Public Projection and Interaction Rules

- Allowed detail fields are enumerated by OpenAPI. Recruiter contacts, internal
  moderation, reports, applications, audit, and private company data are absent.
- Active Apply is derived from current availability and account eligibility;
  a previously rendered action never bypasses the authoritative write recheck.
- Canonical URLs and metadata use only trusted public values.
- Detail feedback targets p95 at or below two seconds and public load at or
  below three seconds under the documented conditions.
- Sections, state labels, actions, focus, and unavailable/retry feedback support
  keyboard navigation, semantic reading order, and 320 CSS pixels.

### Independent Acceptance Matrix

- Open active, closed, expired, unknown, removed, pending, rejected, and private
  slugs as visitor and candidate.
- Compare the neutral outcomes and assert the public field allowlist.
- Verify Apply state, protected-action login return, canonical metadata, saved
  and applied projection, keyboard operation, semantics, and narrow layout.

### Traceability

- Tasks: T024-T031.
- Source: `prisma-public-job-repository.ts`, `job-discovery-service.ts`,
  `app/api/jobs/[jobId]/route.ts` (the segment carries the public slug),
  `app/jobs/[slug]/page.tsx`, and
  `frontend/features/jobs/components/job-detail.tsx`.
- Generated tests: detail policy, detail contract, detail component, and detail
  accessibility suites.

### Exit Gate

US2 is independently complete when every non-public state is indistinguishable,
historical states are explicit, private fields remain absent, and all four
focused suites pass. Measured production performance remains a release gate.
