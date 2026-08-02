# Feature 003 US4 Save or Remove Job Results

**Recorded**: 2026-08-02  
**Use case**: UC-JOB-03  
**Priority / release class**: P2 / Should  
**Result**: PASS for the independent focused automated slice

## Automated Evidence

One focused Vitest invocation covered saved-job integration behavior and the
accessible reconciled Save/Remove control.

Result: **2 test files passed; 4 tests passed; 0 failed**.

## Behaviors Observed

- Composite actor/job ownership and idempotent save/remove behavior are covered.
- Repeated operations converge on the authoritative state.
- Failure reconciliation, pending/success/error feedback, and retry behavior are
  covered without changing another actor's relationship.
- The control has accessible state and keyboard behavior.

## Gate Conclusion

US4 is green as an independent Should increment. It remains subordinate to the
complete US1-US3 Must release path and does not compensate for a missing Must
story or release gate.

---

## Requirements Dossier: US4: Save or Remove a Job

**Use case**: UC-JOB-03
**Priority**: P2
**Release class**: Should
**Primary actor**: Authenticated eligible user
**Requirements**: FR-015 through FR-018, FR-031 through FR-034
**HTTP contracts**: `PUT /api/saved-jobs/{jobId}`,
`DELETE /api/saved-jobs/{jobId}`

### Outcome

An authenticated actor can save a valid job or remove only their own saved
relationship. Repeated and concurrent operations converge on one authoritative
actor-scoped state and the interface visibly reconciles failures.

### Preconditions

- The protected boundary verifies the active session, ACTIVE account, same
  origin, CSRF proof, and strict job ID before invoking the service.
- Ownership is derived from the session; the body cannot nominate another user.
- The target must be a valid public action target at the time of the operation.

### Primary Flow

1. The actor selects Save on a result card or detail page.
2. `PUT` performs unique create-or-read for `(userId, jobId)` and returns
   `{ jobId, saved: true }`.
3. The control announces the authoritative state and disables conflicting input
   only while the request is pending.
4. The actor selects Remove; `DELETE` scopes deletion to the same composite key
   and returns `{ jobId, saved: false }`, even if already absent.
5. List and detail controls reconcile to the server response.

### Alternate and Failure Outcomes

| Condition                               | Required outcome                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Repeated/concurrent Save                | One relationship; successful authoritative `saved: true`.                             |
| Repeated/concurrent Remove              | No relationship; successful authoritative `saved: false`.                             |
| Expired/revoked session or invalid CSRF | No mutation; prompt safe re-authentication/retry.                                     |
| Another actor has saved the job         | Their relationship remains unchanged and undisclosed.                                 |
| Target becomes unavailable              | No prohibited new action; an existing item may remain a neutral historical reference. |
| Database request fails                  | Prior stored state remains authoritative; UI refetches/reconciles and offers retry.   |

### Privacy and Accessibility Rules

- The composite uniqueness key enforces at most one saved relationship per actor
  and posting. No endpoint exposes another user's collection.
- Unavailable saved references reveal no moderation/removal reason or private job
  data and permit no prohibited action.
- Pending, saved, removed, session-expired, error, and retry feedback is announced,
  keyboard operable, focus-safe, non-color-only, and usable at 320 CSS pixels.

### Independent Acceptance Matrix

- Save/remove/repeat/race the same job from list and detail using two users.
- Exercise invalid origin/CSRF, expired session, unavailable target, and injected
  persistence failure; inspect composite ownership and visible reconciliation.

### Traceability

- Tasks: T043-T048.
- Source: `prisma-saved-job-repository.ts`, `saved-job-service.ts`,
  `app/api/saved-jobs/[jobId]/route.ts`, `save-job-action.tsx`, result cards,
  and job detail.
- Generated tests: saved-job PostgreSQL integration and save-action component.

### Exit Gate

US4 is independently complete when both focused suites pass, actor isolation is
preserved, and every repeated/racing operation converges. It is a Should
increment and cannot replace any Must story in the release path.
