# Feature 004 US5 Consent-Retention Results

**Recorded**: 2026-08-02  
**Gate**: T140 US5 checkpoint  
**Result**: PASS

## Isolated verification environment

- US5 verification used fresh PostgreSQL databases created specifically for the
  story. The final aggregate and browser gates targeted
  `cv_us5_20260802_02`; the shared `smarthire` development database was not
  reset, rolled back, or otherwise modified.
- Both `DATABASE_URL` and `DIRECT_URL` targeted the isolated database. Migrations
  `001` through `008_cv_upload_parse_review` were applied from `web/`.
- Controlled-clock Vitest runs used `TZ=UTC`, `--pool=forks`,
  `--no-file-parallelism`, and `--maxWorkers=1`. The persistent CV worker was
  stopped during these tests so it could not compete for controlled leases.
- Browser gates selected the same isolated database for the web process and the
  container-native cleanup worker. New processing was disabled while mandatory
  DELETE/expiry maintenance remained enabled.

## Independent automated matrix

- The combined T114-T122 consent/delete contract, append-only consent, OpenAI
  adapter, dispatch gate, retention/reconciliation, S3 policy, privacy canary,
  component, and accessibility matrix passed **11 files and 75 tests with 0
  failures**.
- Regression tests affected by final lint-safe state management and sanitized
  adapter error handling passed **6 files and 33 tests with 0 failures**.
- The final complete escalated `npm.cmd run test:cv-import` gate passed **51
  files, 313 tests, one container-only skip, and 0 failures**. Its seven-test
  infrastructure file ran in the same successful command. A separate focused
  infrastructure run also passed **7/7**, including npm audit, ClamAV Unix
  socket checks, the container-native cleanup-worker probe, and Docker Scout
  high/critical review.
- Serial Playwright execution of `consent-retention.spec.ts` passed on
  `desktop-chromium` and `mobile-320`: **4 journeys passed; 0 failed**. The
  journeys used real authenticated grant/revoke/delete/status handlers and the
  real cleanup-only worker. They covered the general internal/external notice,
  pre-consent blocking, exact grant, controlled external completion, revoke
  before queued work, changed-binding re-consent, deletion during processing,
  refresh-safe `CANCELLED`/`DELETED` tombstones, natural 30-day expiry, physical
  cleanup, and the manual Candidate Profile path.
- Full-web Prettier, ESLint, and TypeScript gates passed. `npm.cmd run env:check`
  also passed every Compose, PostgreSQL, private-storage, scanner topology,
  retention-constant, immutable-model, and fail-closed configuration check.

## Consent, provider, and privacy evidence

- The browser can grant only with `accepted: true` plus a short-lived
  server-issued HMAC challenge. Provider, parser class, model, purpose, notice,
  text version, account, and upload are server-owned exact bindings. Consent
  events are append-only; replay, tamper, stale challenge, revocation, changed
  binding, expiry, and inaccessible/deleted imports fail closed.
- Deployment approval and exact live consent are both checked after claim and
  again immediately before every OpenAI transmission. Every external attempt is
  linked to its consent event, SDK retries and fallback providers are disabled,
  the approved immutable Responses model/endpoint is enforced, and input/output
  deadlines are bounded.
- The OpenAI adapter is stateless (`store=false`, no tools/files/conversations or
  background mode), uses strict Structured Outputs, and returns only validated
  output plus minimal request evidence. Raw provider errors, CV content,
  disclosure text, object locators, credentials, and synthetic privacy canaries
  were absent from route errors, audit rows, logs, metrics, traces, snapshots,
  and browser storage.
- Local/browser verification intentionally made no OpenAI network call. Live
  production DPA, cross-border, ZDR, account/project approval, bucket policy,
  and customer-managed KMS evidence remain deployment controls documented in
  `production-provider-gates.md`; this checkpoint does not claim those external
  approvals are available.

## Retention and deletion evidence

- Candidate DELETE atomically makes content inaccessible, cancels queued or
  leased work, releases the remaining reservation once, records minimized audit
  evidence, schedules source/extracted/draft/provenance content within 24 hours,
  and returns an idempotent safe `202` `CANCELLED` outcome. `DELETED` is exposed
  only after every referenced object and payload is absent.
- Clock expiry is distinct from candidate deletion. Incomplete/rejected content,
  unconfirmed imports, and confirmed imports retain their exact 24-hour,
  30-day, and seven-day deadlines; natural expiry yields `EXPIRED` without a
  candidate-delete audit and immediately denies content, retry, and confirm.
- Cleanup remains active when uploads/external parsing are disabled. Leased
  delete retries tolerate already-absent objects, scrub database payloads,
  zero content metadata, release quota once, retain only bounded non-content
  receipts/consent/attempt evidence, and emit allowlisted lag telemetry.
- Reconciliation handles missing references and grace-aged orphans with bounded
  pages/leases and never exposes locators. Startup checks reject public,
  versioned, non-KMS, over-retained, or unsafe multipart S3 configuration.
- The status client drops active content immediately after DELETE and keeps only
  the bounded owner tombstone in React memory. No CV state is written to browser
  persistence, and polling stops after `DELETED` or the candidate purge
  deadline.

## Gate conclusion

US5 independently enforces purpose-bound, versioned, future-revocable external
processing and gives the candidate immediate logical deletion with an actively
owned physical-cleanup deadline. Controlled tests prove fail-closed dispatch,
privacy-safe evidence, retention, reconciliation, and desktop/320 browser
behavior. This is a non-release story checkpoint: Phase 8 evidence and all live
production/provider, performance, and usability release gates are still
required before P0 can be claimed.
