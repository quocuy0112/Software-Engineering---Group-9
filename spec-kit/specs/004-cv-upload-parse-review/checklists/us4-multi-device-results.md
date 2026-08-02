# Feature 004 US4 Multi-Device Review Results

**Recorded**: 2026-08-02  
**Gate**: T113 US4 checkpoint  
**Result**: PASS

## Isolated verification environment

- A unique PostgreSQL database was created for US4 without resetting, migrating,
  or otherwise modifying the shared `smarthire` development database.
- Both `DATABASE_URL` and `DIRECT_URL` targeted that isolated database. Migrations
  `001` through `008_cv_upload_parse_review` were applied from `web/`.
- Controlled-clock Vitest runs used `TZ=UTC`, `--pool=forks`,
  `--no-file-parallelism`, and `--maxWorkers=1`.
- Playwright reused separately started local web and capture-email processes; it
  did not start the persistent CV worker or change the PostgreSQL/ClamAV services.

## Test-first and focused evidence

- The new backend suites initially failed only at the intended missing safe
  timestamp projections and replacement-target conflict metadata: **3 failed and
  4 passed**. After implementation, the final focused draft/Profile save,
  confirmation, concurrency, comparison, and rollback matrix passed **6 files and
  24 tests with 0 failures**.
- The new conflict component suite initially failed **2/2** at the intended
  unsaved-value preview, explicit reapply, safe timestamp, and focus behavior.
  Its final result was **2/2 passed**. The combined review contract, component,
  and accessibility regression matrix passed **5 files and 17 tests**.
- Serial Playwright execution of `multi-device-review.spec.ts` plus the inherited
  `review-and-confirm.spec.ts` passed on `desktop-chromium` and `mobile-320`:
  **4 journeys passed; 0 failed**. The losing device retained its values after a
  real 409, explicitly compared and reapplied them to the winner revision, then
  received a Profile conflict and confirmed only after a new review/save.
- The complete escalated `npm.cmd run test:cv-import` matrix passed **40 files,
  236 tests, one container-only skip, and 0 failures**. A prior sandboxed run had
  already passed all 39 application files and failed only because the sandbox
  denied the four external npm/Docker/Scout commands in the infrastructure file.
- The independent dependency/infrastructure gate passed **7/7 tests**, including
  package audit, private ClamAV Unix-socket topology, container-native worker
  probe, exact Node runtime, and Docker Scout high/critical checks.
- Full-web TypeScript, ESLint, and Prettier gates all passed.

## Concurrency and losslessness evidence

- Draft save and confirmation use the deterministic parent-first lock order
  `CandidateProfile -> CvUpload -> CvDraft -> source/replacement targets`, matching
  Feature 002 Profile commands. Save-versus-save, save-versus-confirm, and direct
  Profile-versus-confirm races commit only authorized complete outcomes.
- Every PATCH persists a complete bounded payload behind exact draft-revision CAS.
  A stale writer adds no revision and cannot partially merge fields from either
  session. Conflict projection contains only the latest draft/Profile revisions
  and their UTC update timestamps; no proposal, Profile value, evidence, or
  storage metadata is returned.
- Current Profile revision and replacement-target ownership are rechecked under
  lock. Direct Profile edits plus changed/deleted targets yield explicit
  non-mutating `PROFILE_REVISION_CONFLICT`; a fresh comparison/save advances the
  reviewed Profile binding before confirmation.
- Confirmation rebinds the exact draft, source/reviewed/current Profile revisions
  and the integrity-checked selection manifest. An exact winner replay returns
  one receipt even after later Profile edits, while rebound requests fail. All
  Profile, child, receipt, draft/upload, deletion-deadline, and audit writes roll
  back together at injected failure points, and confirmation increments Profile
  revision exactly once.
- A 409 never replaces the submitting browser's proposals or decisions. All
  changed values remain in React memory and appear in an unsaved-value preview;
  no local/session storage is written. Compare, reapply, and discard/reload are
  separate user actions. Regular save/confirm remains blocked until resolution,
  conflict state is announced, and focus moves to the conflict heading then back
  to the review heading after resolution.

## Gate conclusion

US4 independently rejects stale draft/Profile writes without partial outcomes or
silent browser loss. Multi-tab/device resolution is explicit and server-
authoritative, and confirmation remains impossible until the candidate reviews
and saves against the latest draft and Profile bindings. This is a non-release
story checkpoint; US5 and the remaining completion phases are still required for
P0.
