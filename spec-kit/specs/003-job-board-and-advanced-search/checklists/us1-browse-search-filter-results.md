# Feature 003 US1 Browse, Search, and Filter Results

**Recorded**: 2026-08-02  
**Use case**: UC-JOB-01  
**Priority / release class**: P1 / Must  
**Result**: PASS for the independent focused automated slice

## Automated Evidence

One focused Vitest invocation covered Vietnamese normalization and cursors,
search availability/order policy, job-search integration behavior, the public
`GET /api/jobs` contract, result/search components, and accessibility behavior.

Result: **6 test files passed; 16 tests passed; 0 failed**.

## Behaviors Observed

- Equivalent Vietnamese case/diacritic variants normalize deterministically.
- Invalid criteria and cursors produce bounded safe outcomes.
- Active-public availability, filters, stable ordering, tie-breaks, and cursor
  behavior are exercised independently from other user stories.
- Public response projections and discovery UI states are contract-tested.
- Empty/error recovery, keyboard semantics, and narrow-layout behavior are
  covered by component/accessibility suites.

## Gate Conclusion

The US1 engineering slice is green and can be demonstrated independently.
Production qualification still requires a successfully applied migration and
the documented 100-sample performance run; this result makes no production p95
claim.

---

## Requirements Dossier: US1: Browse, Search, and Filter Jobs

**Use case**: UC-JOB-01
**Priority**: P1
**Release class**: Must
**Primary actor**: Visitor or authenticated user
**Requirements**: FR-001 through FR-008, FR-031 through FR-035
**HTTP contract**: `GET /api/jobs`

### Outcome

An actor can discover approved, currently available jobs without signing in,
using Vietnamese-aware keyword search, supported filters, stable sorting, and
opaque keyset pagination. No private posting, moderation, recruiter, report,
application, or CV field crosses the public boundary.

### Preconditions and Inputs

- The catalogue may be opened anonymously; an optional valid session is used
  only to project the current actor's allowed action state.
- Search input is bounded and strictly parsed. Supported criteria are keyword,
  location, employment type, experience level, work arrangement, disclosed
  salary range, skills/tags, posting date, sort, page size, and cursor.
- Only approved `ACTIVE` postings whose publish time has arrived and whose
  deadline/close time has not passed are eligible for the result set.

### Primary Flow

1. The actor opens `/jobs` or submits search/filter controls.
2. The page serializes only validated criteria into a shareable internal URL.
3. The service normalizes Vietnamese text deterministically while preserving
   original display values.
4. The repository applies public-availability predicates, parameterized search,
   filters, stable ordering, and the job-ID tie-breaker.
5. The response returns an explicit public card projection, total information,
   and an opaque next cursor when more results exist.
6. The page renders results, a meaningful empty state, or a safe retry state;
   valid criteria remain available for correction or retry.

### Alternate and Failure Outcomes

| Condition                                 | Required outcome                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Blank keyword with `RELEVANCE`            | Deterministically fall back to newest order.                                           |
| Same text with case/diacritic differences | Return the same result set.                                                            |
| Invalid enum, range, page size, or cursor | Return `400` with a canonical safe problem; run no search.                             |
| No matching public jobs                   | Return a successful empty result with recovery guidance.                               |
| Posting changes between pages             | Keyset rules prevent duplicate/unstable offset behavior; availability is re-evaluated. |
| Repository is temporarily unavailable     | Return a safe `503`; expose no SQL, provider, or private record details.               |
| Actor session is absent/expired           | Public discovery still works; actor-scoped actions are not projected.                  |

### Data, Privacy, and Performance Rules

- Search reads `Company`, `JobPosting`, and `JobPostingSkill` through the public
  repository projection. It does not read report/application/CV content.
- Normalized title, location, and search-document columns use reviewed trigram
  GIN indexes; lifecycle/sort filters use deterministic B-tree indexes.
- Anonymous public responses may use the documented short public cache.
  Actor-scoped responses are `private, no-store`.
- Search and filter feedback targets p95 at or below two seconds under the
  documented dataset and supported-load conditions.
- Controls, results, validation, focus, and status changes remain usable by
  keyboard and at 320 CSS pixels without relying on color alone.

### Independent Acceptance Matrix

- Seed active, future, expired, closed, pending, rejected, and removed jobs.
- Exercise each filter, combined filters, all sort modes, null salary ordering,
  equal sort keys, page boundaries, malformed cursors, and concurrent changes.
- Compare Vietnamese queries with/without diacritics and case changes.
- Assert the OpenAPI public allowlist and absence of private data.
- Verify empty, invalid, retry, keyboard, semantic, and 320-pixel states.

### Traceability

- Tasks: T015-T023.
- Source: `search-normalization.ts`, `prisma-public-job-repository.ts`,
  `job-discovery-service.ts`, `app/api/jobs/route.ts`, `app/jobs/page.tsx`,
  `job-search-form.tsx`, and `job-card.tsx`.
- Generated tests: search normalization/policy, PostgreSQL search integration,
  search contract, discovery component, and discovery accessibility suites.

### Exit Gate

US1 is independently complete when its unit, integration, contract, component,
and accessibility suites pass and no non-public posting or field is observable.
Production release additionally requires the migration and measured-performance
gates in the feature plan.
