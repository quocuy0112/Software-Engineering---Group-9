# Feature 004 US1 Upload-to-Safe-Draft Results

**Recorded**: 2026-08-01  
**Gate**: T067 US1 checkpoint  
**Result**: PASS

## Independent automated matrix

- `npm.cmd run test:cv-import` against the isolated `smarthire_cv004_test`
  PostgreSQL database, with the long-running worker stopped so it could not
  consume lease-test fixtures: **29 files passed; 148 tests passed; 1
  platform-inapplicable test skipped; 0 failed**.
- The matrix includes the US1 OpenAPI/Zod contracts, account authorization,
  quota/admission, streaming receiver, AES-GCM integrity, private storage,
  live ClamAV, malicious-document/extraction isolation, parser/draft creation,
  worker ordering/leases, UI components, accessibility, and architecture/style
  boundaries.
- The same compatibility run built and probed the real worker image, ran the
  package audit, and ran Docker Scout. The final image contained **0 critical
  and 0 high vulnerabilities**.
- Direct serial Playwright run of `upload-to-draft.spec.ts` on
  `desktop-chromium` and `mobile-320`: **4 journeys passed; 0 failed**. The
  journeys used structurally valid synthetic PDF and DOCX files, reached
  `REVIEW_READY`, survived reload from server state, proved Candidate Profile
  non-mutation, showed actionable image-only replacement/manual-entry
  guidance, and returned an indistinguishable 404 for a foreign account.
- `npm.cmd run typecheck --workspace @smarthire/web`: PASS for the US1 fixes.

## Timing evidence

The isolated database supplied 11 recent successful deterministic PDF/DOCX
pipeline samples that had a CLEAN assessment, successful extraction, and a
persisted draft. No document content, filename, digest, locator, credential, or
provider payload was queried.

| Observation | Samples | P50 | P95 | Maximum | Target result |
|---|---:|---:|---:|---:|---|
| Request/service receipt timestamp to encrypted source-artifact availability | 11 | 301.0 ms | 935.0 ms | 980.0 ms | 11/11 within 5 s: PASS |
| Content receipt to persisted review-ready draft | 11 | 3,907.0 ms | 4,787.5 ms | 5,020.0 ms | 11/11 within 60 s and 3 min: PASS |

The first observation begins at the service receipt clock, before the final
byte is finalized, so it is a conservative local proxy for the specified
post-final-byte pre-scan feedback bound. The full representative-corpus,
concurrent percentile qualification remains owned by Phase 8 T142/T147; this
US1 result is the independent story checkpoint, not a production performance
claim.

## Gate conclusion

US1 independently produces a private review-ready draft without mutating the
Candidate Profile. Upload recovery and account isolation are visible and
actionable at both required viewport sizes.
