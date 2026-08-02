# Feature 004 US2 Review-and-Confirm Results

**Recorded**: 2026-08-01  
**Gate**: T090 US2 checkpoint  
**Result**: PASS

## Independent automated matrix

- Fresh PostgreSQL verification database with migrations `001` through `008`:
  the focused draft contract, comparison, confirmation, and confirmation
  concurrency matrix passed **4 files and 17 tests with 0 failures**.
- Complete `npm.cmd run test:cv-import` matrix on another fresh migrated
  database: all application tests passed. The first run recorded **28 passing
  files, 149 passing tests, one platform-inapplicable skip**, and one
  infrastructure-only Docker Scout failure caused by exhausted analyzer
  temporary-disk space. After pruning only Scout temporary analysis data, the
  compatibility file passed **7/7 tests**. The resulting unique matrix is **29
  files, 150 passing tests, one skip, and 0 unresolved failures**.
- Direct Docker Scout verification of `smarthire-cv-worker:local` analyzed 630
  packages and reported **0 critical, 0 high, and no vulnerable packages**.
- Serial Playwright execution of `review-and-confirm.spec.ts` passed on
  `desktop-chromium` and `mobile-320`: **2 journeys passed; 0 failed**. Each
  journey used an isolated database, local capture-email worker, and protected
  authenticated browser sessions.
- `npm.cmd run typecheck`, the full ESLint gate, and targeted Prettier checks
  for the changed confirmation repository, fixture, and Playwright journey all
  passed.
- The migration fresh-install/drift and upgrade verification gate passed for
  migration `008_cv_upload_parse_review`.

The matrix covers strict GET/PATCH/confirm contracts and no-store responses;
owner-only live-Profile comparison; bounded evidence and explicit unavailable
provenance; complete normalized draft saves with separate draft/provenance byte
caps; revision CAS; target ownership; deterministic row locking; one Profile
revision; exact idempotent receipt replay; rebound-key denial; rollback after
every injected transaction failure point; post-confirmation immutability and
seven-day deletion scheduling; one confirmation audit event; component,
accessibility, 320-pixel, and stylesheet-boundary checks; and indistinguishable
cross-account denial.

## Local timing evidence

The browser observations are one serialized warm-path sample per required
viewport on the local Next.js development server and PostgreSQL Docker service.
They are an independent US2 regression gate, not the Phase 8 production-like
P95 qualification.

| Viewport | Cold development load | Warm review load | Save feedback | Confirm feedback | Warm target result |
|---|---:|---:|---:|---:|---|
| Desktop Chromium | 5,401 ms | 784 ms | 448 ms | 434 ms | 3 s / 2 s / 2 s: PASS |
| Chromium 320 x 720 | 767 ms | 593 ms | 429 ms | 511 ms | 3 s / 2 s / 2 s: PASS |

The desktop cold value includes first-time development compilation and is
reported rather than hidden. A statistically meaningful P50/P95/P99 run with
documented hardware, corpus, concurrency, and cold/warm distributions remains
owned by Phase 8 T147.

## Gate conclusion

US2 independently lets a candidate compare, edit, save, reload, selectively
confirm, and safely replay an import without an alternate parser-to-Profile
write path. The draft, source artifacts, receipt, audit evidence, and Candidate
Profile remain transactionally consistent. This is the documented non-release
technical checkpoint; US3-US5 and every Phase 8 gate remain required for P0.
