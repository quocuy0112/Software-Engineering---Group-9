# Feature 004 Requirements Traceability

**Recorded:** 2026-08-02  
**Implementation trace:** **COMPLETE**  
**P0 production release:** **BLOCKED**

`PASS` below means that the implementation is traced to isolated automated or
measured local evidence. It does not mean that an unavailable production
provider, ingress, organizational approval, or participant study was observed.
Those distinctions are explicit in the status column and in the release matrix.

## Evidence Keys

- **FND** — [foundation results](foundation-results.md)
- **US1** — [upload and safe-draft results](us1-upload-safe-draft-results.md)
- **US2** — [review and confirmation results](us2-review-confirm-results.md)
- **US3** — [failure and recovery results](us3-failure-recovery-results.md)
- **US4** — [multi-device and conflict results](us4-multi-device-results.md)
- **US5** — [consent and retention results](us5-consent-retention-results.md)
- **DEP** — [dependency and infrastructure gate](dependency-infrastructure-gate.md)
- **MIG** — [migration results](migration-results.md)
- **PERF** — [performance results](performance-results.md)
- **USE** — [usability results](usability-results.md)
- **PROD** — [production provider gates](production-provider-gates.md)
- **FINAL** — [final quality gate](final-quality-gate.md)

## Functional Requirements

| Requirement                                                                                | Implemented tasks                                                          | Passing evidence and status                                                                        |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FR-001 authenticated ACTIVE owner for every operation                                      | T022, T035, T069, T098, T126-T131, T150                                    | FND, US1-US5, FINAL — PASS                                                                         |
| FR-002 server-session-derived ownership only                                               | T013, T022, T028, T035, T069, T076, T125, T150                             | FND, US1, US2, US5, FINAL — PASS                                                                   |
| FR-003 inherited same-origin/CSRF protections on mutations                                 | T013, T022, T048-T050, T081-T082, T099, T127, T131, T150                   | FND, US1-US5, FINAL — PASS                                                                         |
| FR-004 non-disclosing missing/foreign/expired/deleted access                               | T023, T035, T069, T114, T131                                               | FND, US1, US2, US5 — PASS                                                                          |
| FR-005 PDF/DOCX, 1..5,000,000-byte authoritative limit                                     | T034, T037, T044, T046-T049                                                | US1, PERF — PASS locally                                                                           |
| FR-006 extension/type/signature agreement and post-clean structure validation              | T037-T039, T052, T059-T060                                                 | US1, US3 — PASS                                                                                    |
| FR-007 unsafe/corrupt/encrypted/active documents rejected pre-parse                        | T039, T053-T055, T060, T092                                                | US1, US3 — PASS                                                                                    |
| FR-008 PDF page and DOCX expansion/entry/path/relationship caps                            | T039, T054-T055                                                            | US1 — PASS                                                                                         |
| FR-009 filename is private metadata, never a path/public locator                           | T010, T024, T026-T027, T046, T063                                          | FND, US1 — PASS                                                                                    |
| FR-010 rate/import/storage/active-parse account caps                                       | T036, T045, T061                                                           | US1 — PASS                                                                                         |
| FR-011 atomic quota reservation/reconciliation/release                                     | T036, T045, T047, T132                                                     | US1, US5 — PASS                                                                                    |
| FR-012 incomplete upload creates no work/draft and purges within 24 hours                  | T037, T047, T118, T132                                                     | US1, US5 — PASS with controlled clock                                                              |
| FR-013 server SHA-256 integrity binding without disclosure                                 | T014, T037, T047, T052, T059-T060                                          | FND, US1, US5 privacy canary — PASS                                                                |
| FR-014 exact upload idempotency replay and rebound rejection                               | T034, T036, T045-T047                                                      | US1 — PASS                                                                                         |
| FR-015 no silent draft reuse/cross-account digest deduplication                            | T035-T036, T045-T047                                                       | US1 — PASS                                                                                         |
| FR-016 quarantine until bounded checks and trustworthy clean scan                          | T038-T041, T047, T051-T061                                                 | US1, US3 — PASS                                                                                    |
| FR-017 private replaceable ClamAV, same-host/pod Unix socket, no TCP/sample sharing        | T021, T032, T038, T051, T059, T135                                         | FND, US1, DEP — PASS local/automated; production in-pod evidence BLOCKED                           |
| FR-018 explicit scan states and fail-closed indeterminate outcomes                         | T038, T051, T059, T092, T100                                               | US1, US3 — PASS                                                                                    |
| FR-019 bounded structured scan assessment evidence                                         | T031, T038, T059                                                           | US1, US5 privacy evidence — PASS                                                                   |
| FR-020 only authorized, unexpired, CLEAN uploads continue                                  | T041, T052, T059-T061, T092, T119                                          | US1, US3, US5 — PASS                                                                               |
| FR-021 infected file denial, safe result, and 24-hour purge                                | T038, T059, T092, T118, T132                                               | US1, US3, US5 — PASS with controlled clock                                                         |
| FR-022 three-attempt/five-minute automatic scan cycle and two single user retries          | T091, T093, T097-T100                                                      | US3 — PASS with controlled clock                                                                   |
| FR-023 account/worker-private artifacts, no public/executable serving                      | T011, T015, T025-T027, T035, T056, T121, T141                              | FND, US1, US5, FINAL — PASS                                                                        |
| FR-024 protected transit/at-rest, HTTPS provider/browser, Unix-socket scanner              | T010, T021, T024-T027, T032, T135, T151                                    | FND, DEP, PROD, FINAL — encryption/socket PASS; deployed HTTPS gate BLOCKED                        |
| FR-025 safe structured review, never inline original document                              | T015, T039-T040, T058, T069, T084, T141                                    | US1, US2, FINAL — PASS                                                                             |
| FR-026 import source only, never a permanent CV library/attachment                         | T079, T118, T130-T133, T145                                                | US2, US5, FINAL — PASS                                                                             |
| FR-027 24-hour/30-day/7-day deletion windows without deleting Profile                      | T118, T130, T132                                                           | US5, PERF — PASS with controlled clock; production storage deployment BLOCKED                      |
| FR-028 immediate logical denial and receipt-only confirmed access                          | T050, T079, T118, T130-T132                                                | US2, US5 — PASS                                                                                    |
| FR-029 owned cleanup, storage safeguard, and reconciliation                                | T119-T120, T132-T135                                                       | US5, PERF, PROD — PASS local/automated; live S3 lifecycle evidence BLOCKED                         |
| FR-030 candidate delete cancellation, denial, purge, quota release, DELETED ordering       | T114, T118-T119, T124, T130-T134, T137-T138                                | US5 — PASS with controlled clock                                                                   |
| FR-031 asynchronous scan/extract/parse                                                     | T041, T047, T059-T062, T100                                                | US1, US3, PERF — PASS locally                                                                      |
| FR-032 persistent, distinct, candidate-visible lifecycle states                            | T044, T050, T064-T065, T096, T101, T124, T137-T138                         | US1, US3, US5, FINAL — PASS                                                                        |
| FR-033 durable/idempotent/leased crash-safe work, no duplicate drafts                      | T012, T029-T030, T041, T093, T100                                          | FND, US1, US3 — PASS                                                                               |
| FR-034 per-upload available-parser choice, replaceable extraction/parsing, no Profile write | T034, T042, T046, T053, T057-T058, T064, T128                             | US1, US5 — PASS                                                                                    |
| FR-035 parser result is draft-only; no direct Profile write                                | T040-T041, T057-T061, T079-T080                                            | US1, US2, full uninterrupted E2E — PASS                                                            |
| FR-036 extraction only; no rewriting/scoring/ranking/recruitment decision                  | T040, T057-T058, T116, T128                                                | US1, US5 — PASS                                                                                    |
| FR-037 versioned/timed/attempt-safe parser trace                                           | T040, T061, T092, T100, T116, T128-T129, T139                              | US1, US3, US5 — PASS                                                                               |
| FR-038 strict whole-output rejection of untrusted parser data                              | T009, T020, T040, T058, T116, T128                                         | FND, US1, US5 — PASS                                                                               |
| FR-039 Candidate Profile collection and field caps                                         | T020, T040, T058, T070                                                     | US1, US2 — PASS                                                                                    |
| FR-040 256 KiB draft and 128 KiB provenance caps, no raw text embedding                    | T008-T009, T020, T040, T058, T070, T077                                    | FND, US1, US2 — PASS                                                                               |
| FR-041 oversized output fails whole with safe recovery                                     | T040, T058, T092, T096, T101                                               | US1, US3 — PASS                                                                                    |
| FR-042 60-second parse deadline, three-attempt/three-minute automatic cycle                | T093, T100, T116, T128-T129                                                | US3, US5, PERF local timing — PASS under documented local conditions; live provider timing BLOCKED |
| FR-043 terminal parse failure keeps history and offers Profile/manual/replacement/retry    | T091-T102                                                                  | US3 — PASS                                                                                         |
| FR-044 at most two immutable single-attempt candidate parse retries                        | T091, T093, T097-T100                                                      | US3 — PASS                                                                                         |
| FR-045 no automatic cross-provider fallback without new consent                            | T117, T129                                                                 | US5 — PASS fail-closed                                                                             |
| FR-046 no admin DLQ/direct-DB recovery requirement                                         | T094-T095, T100-T102                                                       | US3 — PASS                                                                                         |
| FR-047 image-only/insufficient text gives actionable unsupported result; no OCR            | T039, T054, T092, T101                                                     | US1, US3 — PASS                                                                                    |
| FR-048 document instructions remain inert data and cause no tools/network/policy action    | T040, T057, T116, T128                                                     | US1, US5 — PASS                                                                                    |
| FR-049 independent, revisioned, source-bound draft                                         | T016, T058, T068-T077                                                      | MIG, US1, US2 — PASS                                                                               |
| FR-050 confidence/bounded provenance or explicit unavailable state                         | T040, T058, T068-T069, T073, T084                                          | US1, US2 — PASS                                                                                    |
| FR-051 Profile-aware scalar choices plus per-entry/per-skill explicit review               | T068, T070, T073, T075-T086                                                | US2, full uninterrupted E2E — PASS                                                                 |
| FR-052 Profile duplicate hints plus in-draft skill/link duplicates never auto-merge         | T040, T058, T069, T078, T085                                               | US1, US2 — PASS                                                                                    |
| FR-053 Profile validation parity, exact field errors, edit preservation, summary/toast/focus | T020, T070, T073, T077-T078, T083-T087                                    | US2 — PASS                                                                                         |
| FR-054 atomic draft revision increment                                                     | T070, T077, T103, T107                                                     | US2, US4 — PASS                                                                                    |
| FR-055 base-revision CAS; stale save rejected without last-write-wins                      | T070, T077, T103, T107                                                     | US2, US4 — PASS                                                                                    |
| FR-056 confirmation bound to exact reviewed draft revision                                 | T071-T072, T079-T082, T104, T109                                           | US2, US4 — PASS                                                                                    |
| FR-057 stale-edit UI preserves unsaved values and requires deliberate resolution           | T105, T110-T112                                                            | US4 — PASS                                                                                         |
| FR-058 resumable saved draft and explicit save/conflict states; immutable after confirm    | T063, T068, T073, T083, T087, T105, T110-T112                              | US1, US2, US4 — PASS                                                                               |
| FR-059 no persistent browser storage for CV/draft/consent/tokens                           | T015, T042, T063, T105, T110, T121, T138, T141                             | FND, US1, US4, US5, FINAL — PASS                                                                   |
| FR-060 unconfirmed draft expires by 30 days and cannot confirm                             | T068-T071, T118, T130-T132                                                 | US2, US5 — PASS with controlled clock                                                              |
| FR-061 confirmation applies selected values only                                           | T068-T072, T075-T080                                                       | US2, full uninterrupted E2E — PASS                                                                 |
| FR-062 pre-confirm account/owner/upload/draft/revision/consent/Profile revalidation        | T071-T072, T079-T080, T104, T109                                           | US2, US4 — PASS                                                                                    |
| FR-063 changed Profile forces fresh comparison and explicit reconfirmation                 | T104, T108-T112                                                            | US4 — PASS                                                                                         |
| FR-064 one atomic selected-change/revision/lock/receipt/audit outcome                      | T071, T079, T109                                                           | US2, US4, full uninterrupted E2E — PASS                                                            |
| FR-065 stable owned child identifiers and target ownership                                 | T069, T071-T072, T076, T079, T104, T109                                    | US2, US4 — PASS                                                                                    |
| FR-066 exact HMAC confirmation idempotency binding and replay                              | T068, T071, T079-T082, T109                                                | US2, US4 — PASS                                                                                    |
| FR-067 complete rollback on confirmation failure                                           | T071-T072, T079, T104, T109                                                | US2, US4 — PASS                                                                                    |
| FR-068 confirmed text/links remain inert and safe-scheme only                              | T020, T070, T079, T085, T143                                               | US2, FINAL — PASS                                                                                  |
| FR-069 explicit unselected purpose/provider consent before external send                   | T042, T064, T114-T117, T122-T129                                           | US1, US5 — PASS fail-closed; approved live provider BLOCKED                                        |
| FR-070 durable exact-binding/versioned consent evidence                                    | T008, T115, T125-T127                                                      | FND, US5 — PASS                                                                                    |
| FR-071 every external attempt/retry references live exact consent                          | T028, T093, T115, T117, T125-T129                                          | FND, US3, US5 — PASS automated; live provider BLOCKED                                              |
| FR-072 revocation blocks undispatched/later work with past-processing caveat               | T115, T117, T125-T129, T136                                                | US5 — PASS                                                                                         |
| FR-073 changed upload/provider/purpose/notice/text requires new grant                      | T115, T117, T125-T129                                                      | US5 — PASS                                                                                         |
| FR-074 minimum external payload; no sessions/credentials/locators/secrets                  | T116-T117, T121, T128-T129                                                 | US5 — PASS automated; live provider BLOCKED                                                        |
| FR-075 telemetry excludes all CV/PII/secret/provider/scanner payloads                      | T014, T023, T031, T038, T121, T139                                         | FND, US1, US5 — PASS privacy canaries                                                              |
| FR-076 allowlisted content-free audit outcomes across full lifecycle                       | T008, T031, T059-T061, T098, T115, T118, T130, T139                        | FND, US1, US3, US5 — PASS                                                                          |
| FR-077 stable safe actionable errors without internals                                     | T023, T038, T051, T092, T096, T101, T128                                   | FND, US1, US3, US5 — PASS                                                                          |
| FR-078 persistent keyboard controls and explicit cancel/delete at desktop/320 px           | T042, T064, T073, T086, T094, T101, T105, T111, T122, T136-T138, T143      | US1-US5, FINAL — PASS automated                                                                    |
| FR-079 announced status/save changes, invalid-field ARIA/focus, text summary, non-color status | T042, T064, T073, T083-T087, T094, T101, T105, T111, T122, T136-T138, T143 | US1-US5, FINAL — PASS automated                                                                 |
| FR-080 navigate away/return without server progress or saved-edit loss                     | T043, T063, T083, T095, T106, T123, T149                                   | US1-US5, FINAL — PASS                                                                              |

## Verification Requirements

The ten bullets in `spec.md` are labelled VR-001 through VR-010 here only for
traceability; these labels do not alter the specification.

| Verification requirement                                                                                | Implemented test tasks                 | Evidence and status                                                |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| VR-001 strict upload/draft/consent/retry/conflict/confirm/error contracts                               | T009, T034, T068, T091, T114, T150     | FND, US1-US5, FINAL — PASS                                         |
| VR-002 two-account authorization, forged IDs, session expiry/revocation, digest equality                | T013, T035, T069, T150                 | FND, US1, US2, FINAL — PASS                                        |
| VR-003 complete malicious/unsafe/interrupted file corpus                                                | T037-T039, T092                        | US1, US3 — PASS                                                    |
| VR-004 private scanner/storage, fail-closed scan, integrity, idempotency, quota, cleanup/reconciliation | T011, T032, T036-T038, T041, T118-T120 | FND, US1, US5 — PASS local/automated; production providers BLOCKED |
| VR-005 interruption/delivery/lease/timeout/retry/provider/output/injection/no-Profile-write parsing     | T012, T040-T041, T092-T093, T116-T117  | FND, US1, US3, US5 — PASS automated; live OpenAI BLOCKED           |
| VR-006 all specified draft/profile/confirm/delete concurrency races                                     | T070-T072, T103-T104, T119             | US2, US4, US5 — PASS                                               |
| VR-007 end-to-end telemetry privacy canaries                                                            | T014, T121                             | FND, US5 — PASS                                                    |
| VR-008 controlled-clock logical/physical retention, quota release, reconciliation                       | T118-T120                              | US5, PERF — PASS                                                   |
| VR-009 keyboard/status/error/conflict/motion/contrast/320-pixel component accessibility                 | T042, T073, T094, T105, T122, T143     | US1-US5, FINAL — PASS automated                                    |
| VR-010 authenticated E2E clean/failure/consent/conflict/expiry/delete journeys                          | T043, T074, T095, T106, T123, T149     | US1-US5, FINAL — PASS: all 16 serial desktop/mobile instances      |

## Success Criteria

| Criterion                                                                           | Implemented tasks                  | Evidence and release status                                                               |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| SC-001 P95 pre-scan feedback <=5 seconds                                            | T142, T147                         | PERF: local P95 305.41 ms — local PASS; production-qualified run BLOCKED                  |
| SC-002 100% unsafe corpus denied every downstream stage                             | T037-T041, T092                    | US1, US3 — PASS automated                                                                 |
| SC-003 >=90% actionable <=60 seconds and all <=3 minutes                            | T142, T147                         | PERF: 10/10 <=60 seconds, max 4.76 seconds — local PASS; live-provider conditions BLOCKED |
| SC-004 P95 review <=3 seconds; save/confirm <=2 seconds                             | T090, T142, T147                   | PERF: 652.76/419.11/271.41 ms — local PASS; production qualification BLOCKED              |
| SC-005 >=30-person moderated desktop/320-pixel usability study, >=90% first attempt | T146                               | USE: 0/30 — BLOCKED                                                                       |
| SC-006 no silent loss/partial/duplicate concurrency outcome                         | T072, T103-T113                    | US2, US4 — PASS                                                                           |
| SC-007 all-or-nothing confirmation state/audit outcome                              | T071-T072, T104, T109              | US2, US4 — PASS                                                                           |
| SC-008 100% exact valid consent before external dispatch                            | T115, T117, T125-T129              | US5 — PASS enforced in automated dispatch tests; live provider remains disabled/BLOCKED   |
| SC-009 immediate denial and exact 24-hour/30-day/7-day physical windows             | T118-T120, T130-T134               | US5 — PASS with controlled clock; production storage evidence BLOCKED                     |
| SC-010 zero sensitive values in telemetry/audit scans                               | T014, T121, T139                   | FND, US5 — PASS                                                                           |
| SC-011 keyboard/text/announcement/no-horizontal-scroll primary workflow             | T042, T073, T094, T105, T122, T143 | US1-US5, FINAL — PASS automated                                                           |
| SC-012 >=99% no-manual cleanup and complete injected reconciliation                 | T119, T142, T147                   | PERF: 100/100 (100%), zero manual interventions; US5 reconciliation tests PASS            |

## Consent and Retention Invariants

| Invariant                                                                                                            | Task/evidence trace                           | Status                                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Consent starts unselected and binds exact account/upload/provider/purpose/notice/text versions                       | T042, T064, T114-T115, T124-T127; US1, US5    | PASS                                                            |
| Every external initial/automatic/user retry carries and revalidates the consent event immediately before send        | T093, T115, T117, T125, T129; US3, US5        | PASS automated; live provider BLOCKED                           |
| Revocation blocks future dispatch but does not claim to reverse completed provider work                              | T115, T122, T126, T136; US5                   | PASS                                                            |
| Provider/purpose/version/upload changes never broaden an old grant, and there is no automatic fallback               | T115, T117, T125, T129; US5                   | PASS                                                            |
| External deployment remains disabled without DPA, cross-border, ZDR, immutable model, key, and exact endpoint gates  | T021, T117, T129, T135; PROD, FINAL           | PASS fail-closed; approvals/live smoke BLOCKED                  |
| Uploaded CV is an import source only; Profile values survive temporary-artifact cleanup                              | T079, T118, T130-T133; US2, US5               | PASS                                                            |
| Rejected/infected/incomplete content purges <=24 hours, unconfirmed <=30 days, confirmed payload/provenance <=7 days | T118, T130, T132; US5                         | PASS with controlled clock; production storage evidence BLOCKED |
| Expiry/delete/confirmation denies content immediately, independently of eventual physical deletion                   | T118, T130-T132, T138; US5                    | PASS                                                            |
| Candidate deletion cancels work, discards late results, releases quota once, and reaches DELETED only after absence  | T119, T130-T134; US5                          | PASS                                                            |
| Cleanup is owned, leased, idempotent, always enabled, and paired with missing/orphan reconciliation                  | T119-T120, T132-T135; US5, PERF               | PASS local/automated; live S3 safeguard BLOCKED                 |
| Confirmed access is receipt-only and retains no source snippets, skipped/selected values, or full draft              | T071, T079, T118, T132; US2, US5              | PASS                                                            |
| Logs/browser stores/audit never retain CV content, filename, consent text, locators, prompts, tokens, or responses   | T014, T015, T121, T139, T141; FND, US5, FINAL | PASS privacy canaries                                           |

## Constitution Gates

| Gate                                               | Implemented task/evidence trace                                                      | Status                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| I Human-controlled recruitment                     | T040, T058, T068-T087, T149; US1, US2, FINAL                                         | PASS: extraction-only draft and explicit candidate choice; no scoring/ranking/action            |
| II Security, privacy, tenant isolation             | T008-T039, T114-T140, T150; FND, US5, FINAL                                          | Implementation/local PASS; production HTTPS/S3/KMS/ClamAV/OpenAI evidence BLOCKED               |
| III Deterministic core / explainable AI            | T039-T061, T091-T100, T116-T129; US1, US3, US5                                       | PASS automated; optional external provider remains non-authoritative and disabled without gates |
| IV State, audit, integrity                         | T008, T012, T016-T031, T071-T072, T103-T109; FND, MIG, US2, US4                      | PASS                                                                                            |
| V Scope / complete P0                              | US1 T034-T067, US2 T068-T090, US3 T091-T102, US4 T103-T113, US5 T114-T140, T141-T152 | Engineering scope COMPLETE; release BLOCKED by unmet gates below                                |
| VI Quality / accessibility                         | T090, T102, T113, T140, T142-T147, T149-T151; PERF, USE, FINAL                       | Automated/local quality PASS; usability and production-qualified performance BLOCKED            |
| VII Maintainable provider-independent architecture | T015, T021, T025, T028-T030, T051, T053, T057, T128, T141                            | FND, DEP, FINAL — PASS architecture boundaries                                                  |

No waiver or complexity exception is recorded.

## Mandatory P0 Scope and Release Matrix

| Required scope                                                               | Completion evidence                          | Release state                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| US1 T034-T067                                                                | US1 checklist                                | Implemented and green                                      |
| US2 T068-T090                                                                | US2 checklist                                | Implemented and green                                      |
| US3 T091-T102                                                                | US3 checklist                                | Implemented and green                                      |
| US4 T103-T113                                                                | US4 checklist                                | Implemented and green                                      |
| US5 T114-T140                                                                | US5 checklist                                | Implemented and green                                      |
| T141-T145 architecture/instrumentation/accessibility/docs/live-smoke harness | Complete Vitest/build/docs evidence in FINAL | Implemented and green; live smoke skipped safely           |
| T146 usability                                                               | USE                                          | Task/report complete; acceptance gate BLOCKED at 0/30      |
| T147 performance                                                             | PERF                                         | Local measured gate PASS; production qualification BLOCKED |
| T148 migration                                                               | MIG                                          | PASS                                                       |
| T149 uninterrupted authenticated generated-draft E2E                         | FINAL                                        | PASS desktop and 320-pixel projects                        |
| T150 real Route Handler session-boundary matrix                              | Complete Vitest evidence in FINAL            | PASS                                                       |
| T151 final quality execution/report                                          | FINAL                                        | Engineering validation PASS; production controls BLOCKED   |
| T152 this complete trace                                                     | This document                                | Complete; does not approve release                         |

P0 must not release merely because all engineering tasks are checked. Release
remains blocked until the 30-participant usability criterion passes, a
production-qualified performance run passes, and approved evidence exists for
trusted HTTPS ingress/redirect/HSTS/cookie-origin behavior, private S3/KMS and
role credentials, production in-pod ClamAV, OpenAI organizational approvals
and synthetic-only live smoke, and production backup/restore. No unavailable
live-provider or production control is claimed by this trace.
