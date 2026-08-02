# Feature 004 US3 Failure-Recovery Results

**Recorded**: 2026-08-02  
**Gate**: T102 US3 checkpoint  
**Result**: PASS

## Isolated verification environment

- A unique PostgreSQL verification database was created without resetting or
  modifying the shared `smarthire` development database.
- Both `DATABASE_URL` and `DIRECT_URL`, plus the container-native CV worker
  database name, were overridden to the isolated database.
- Migrations `001` through `008_cv_upload_parse_review` applied successfully
  from `web/`.
- Controlled-clock Vitest runs used `TZ=UTC`, `--pool=forks`,
  `--no-file-parallelism`, and `--maxWorkers=1`.

## Independent automated matrix

- The terminal failure and controlled retry suites passed **2 files and 35
  tests with 0 failures**. This includes the completion-time lease and import
  authority guard, discarded parser results, bounded automatic/candidate retry
  cycles, fixed backoff, exact consent propagation, five-minute scan-cycle
  scheduling, and late-queued scan terminalization without invoking ClamAV.
- The focused worker, lease, encrypted-segment PostgreSQL round-trip, draft,
  fail-closed projection, retry route/contract, storage cleanup, and telemetry
  matrix passed **10 files and 77 tests with 0 failures**.
- The protected retry contract plus real Route Handler matrix passed **2 files
  and 28 tests with 0 failures**. `route.ts` exports only the static `POST`
  method; the injectable factory is isolated in adjacent `handler.ts`.
- Serial Playwright execution of `failure-recovery.spec.ts` passed on
  `desktop-chromium` and `mobile-320`: **2 journeys passed; 0 failed**. The
  authenticated journeys received real 202 responses for scan and parse retry,
  verified exact durable prior/new attempt bindings and counters, survived
  refresh, left processing after an authoritative terminal transition, and had
  no horizontal overflow at 320 pixels. The persistent CV worker was stopped
  for this route/state test so it could not consume the queued retry before the
  browser verified it; the local web and capture-email workers remained active.
- The complete `npm.cmd run test:cv-import` matrix passed **37 files, 225 tests,
  one container-only skip, and 0 failures**. The skipped path is separately
  covered by the live infrastructure gate.
- The independent dependency/infrastructure gate passed **7/7 tests**, including
  package audit, private ClamAV Unix-socket topology, container-native worker
  probe, exact Node runtime, and Docker Scout high/critical checks.
- Full-web Prettier, ESLint, and TypeScript gates all passed.

## Safety and durability evidence

- A stage result is accepted only while the exact processing lease is owned and
  unexpired, the account is active, and the upload plus required artifacts are
  accessible, unexpired, and in an allowed state. Lost-lease, cancelled,
  expired, or inaccessible completions fail with `CV_STAGE_RESULT_DISCARDED`.
- Rejected commits create no draft, output artifact, or downstream work.
  Storage objects written before a rejected guarded transaction are deleted.
- Parse-capable runtimes default to a 90-second lease and reject leases shorter
  than 65 seconds, leaving margin beyond the 60-second parser hard deadline.
- Automatic external parse retries copy the exact `consentEventId`. Automatic
  scan attempts cannot be scheduled or executed too late to finish within the
  five-minute cycle budget, and candidate retries never restart an automatic
  cycle.
- Authorized terminal outcomes and newly scheduled automatic retries emit only
  allowlisted logs/metrics. Their audit rows are inserted transactionally with
  deterministic exactly-once identifiers; stale finalize and replay paths add
  neither duplicate audit rows nor telemetry.
- Failure UI exposes bounded retry where safe plus replacement, manual Profile,
  and Delete controls without operator, DLQ, scanner, or provider diagnostics.
  The actual DELETE mutation remains intentionally owned by T131 and was not
  implemented early during US3.

## Gate conclusion

US3 independently reaches stable, candidate-understandable terminal states;
safe retry requests are bounded, consent-aware, idempotent, auditable, and
durable across refresh. Worker results cannot commit after authority is lost,
and no hidden administrator or dead-letter recovery path is required. This is a
non-release story checkpoint; US4, US5, and the remaining completion phases are
still required for P0.
