# Quickstart: Recruitment Pipeline Kanban Board Validation

This guide describes the end-to-end evidence expected after implementation. It does not create tasks or provide production implementation code.

## Prerequisites

- Node.js 24.18.x and npm 11.16.x.
- Docker services required by the existing local environment.
- A migrated PostgreSQL database and generated Prisma client.
- Email capture adapter for deterministic delivery assertions.
- Fixtures for one active verified company with `OWNER`, `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER`; a second company; Active, Closed, and Removed jobs; optional review aggregate mappings; and candidates/applications across all nine stages.

PowerShell users may run `npm.cmd` instead of `npm` if local script execution policy blocks `npm.ps1`.

## Environment and Static Validation

```powershell
npm run env:check
npm run db:up
npm run db:validate --workspace @smarthire/web
npm run db:generate --workspace @smarthire/web
npm run typecheck --workspace @smarthire/web
npm run lint --workspace @smarthire/web
```

Expected:

- Prisma validates without a Feature 019 migration.
- TypeScript recognizes the pipeline contracts and exact DnD dependency.
- Architecture checks report no client access to Prisma, notification providers, or authorization internals.

## Targeted Automated Validation

Run the existing application, scoring, notification, and job-review regression suites plus the Feature 019 directories created during implementation:

```powershell
npm run test:applications --workspace @smarthire/web
npm run test:scoring --workspace @smarthire/web
npm run test:notifications --workspace @smarthire/web
npm run test:job-post-reviews --workspace @smarthire/web
npx vitest run web/tests/backend/unit/applications web/tests/backend/integration/applications web/tests/backend/contract/applications web/tests/security/applications web/tests/frontend/applications web/tests/frontend/accessibility/applications web/tests/architecture/applications web/tests/performance/applications
```

Expected evidence:

- The canonical transition matrix has complete allowed/disallowed coverage.
- `OWNER` reads but every mutation path denies; the other three roles can perform valid decisions.
- Direct database IDs and catalogue-to-public mappings resolve to the same application-owning job.
- Cross-company, inactive, removed, ambiguous/unmapped, and stale contexts disclose no application data.
- Closed jobs remain readable/mutable under normal policy.
- Exact command retries replay one outcome; changed-payload key reuse conflicts; same-version races commit at most one result.
- Stage, history, audit, in-app notification, and email intent are consistent; scoring state never changes.
- Ordinary email preference is honored and Hired email is always queued.
- Rejection/Offer Declined/Hired confirmation and reason rules pass.
- Every cursor page across a 10,000-application fixture is reachable without duplicate/missing application IDs.

## Manual Browser Validation

Start the existing app and email worker using the repository's normal local workflow:

```powershell
npm run dev
npm run email:worker --workspace @smarthire/web
```

### 1. Job identity and closed-job behavior

1. Sign in as an authorized Recruiter member.
2. Open `/recruiter/candidates` and select a newly review-managed job whose catalogue ID differs from its public `JobPosting.id`.
3. Switch to Pipeline board.
4. Verify existing applications appear under their authoritative stages and document/detail actions work.
5. Repeat for a Closed job; verify its existing pipeline and permitted moves remain available.
6. Remove/revoke the job or membership in a second session and refresh/move; verify the board clears stale application data and reports unavailable.

### 2. Role matrix and tenant isolation

1. As `OWNER`, verify the board, authorized details, and stage controls are available.
2. Perform a valid mutation as `OWNER`; expect the authoritative state, history, audit, and notification updates.
3. Repeat a valid move as `OWNER`, `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER`; expect success.
4. With a user belonging to two companies, alter the selected job/application pairing; expect no cross-company data or successful write.

### 3. Pointer and non-drag movement

1. Drag an Applied card to an allowed stage; verify feedback appears within 500 ms and the persisted result appears within two seconds under representative conditions.
2. Drop onto an invalid stage and cancel with Escape; verify no command commits.
3. Use only Tab, Shift+Tab, Enter/Space, arrows, and the explicit Change stage control to complete the same ordinary move.
4. Verify focus returns to the moved card or a meaningful destination control and live feedback describes the result without relying on color.

### 4. Consequential decisions

1. Choose Rejected, verify the six-value reason selector and explicit confirmation, and optionally enter an internal note.
2. Cancel once; verify no side effect. Confirm once; verify the terminal stage, stored reason, candidate notification, and no candidate-visible private note.
3. From Offered, record Offer Declined with the required reason; verify it is terminal and no candidate offer-response UI is introduced.
4. Drag Offered toward Hired; verify drag alone cannot commit. Complete the separate human confirmation and verify Hired plus the mandatory email even when application-update email preference is disabled.
5. Trigger candidate acceptance activity or update score data without recruiter confirmation; verify the stage does not change.

### 5. Concurrency and retry

1. Open the same application in two authorized browser sessions.
2. Commit User A's move, then submit User B's stale version.
3. Verify User A remains authoritative, User B sees understandable conflict feedback, and the card reconciles.
4. Simulate a lost response after commit and select Retry; verify the exact idempotency key/payload is reused and only one stage event, audit success, in-app notification, and applicable email exist.
5. Make a genuinely different later move; verify it uses the latest version and a new idempotency key.

### 6. Scale and optional scoring

1. Load the documented 10,000-application job distribution.
2. Verify all nine counts sum to the authorized application total and the board becomes usable within the two-second P95 target without rendering every card.
3. Traverse each column's Load more controls/cursors and confirm all application IDs are discoverable once.
4. Move a loaded card between stages; verify counts and affected pages reconcile without loading unrelated full columns.
5. Repeat with scored, processing, failed, and never-scored applications; every card remains actionable and score remains advisory.

## Performance Evidence

Record:

- environment and build mode;
- fixture distribution across nine stages and optional scoring states;
- sample size, warm-up, duration, and concurrent actor count;
- P50/P95/P99/max and error rate for metadata, column page, stage persistence, visual feedback, and in-app visibility;
- external email adapter conditions;
- maximum simultaneously rendered cards and transferred payload size.

Acceptance targets are defined in [spec.md](./spec.md); contracts and failure responses are defined in [contracts/recruitment-pipeline.openapi.yaml](./contracts/recruitment-pipeline.openapi.yaml).

## Final Regression Gate

```powershell
npm run test --workspace @smarthire/web
npm run build --workspace @smarthire/web
```

Expected: all existing candidate application tracking, ranking/scoring, notification, job-review, and Recruiter workspace behavior remains operational; no `tasks.md` or production implementation is generated by this planning phase.
