# Feature 003 Requirements Traceability

**Recorded**: 2026-08-02  
**Implementation trace**: COMPLETE for the five selected user stories  
**Production release**: BLOCKED

`PASS` means the requirement is connected to implemented source and passing
focused automated evidence. It does not claim that an unavailable database,
provider, performance environment, or participant study was observed.

## Evidence Keys

- **FND** — [foundation-results.md](foundation-results.md)
- **US1** — [us1-browse-search-filter-results.md](us1-browse-search-filter-results.md)
- **US2** — [us2-view-job-details-results.md](us2-view-job-details-results.md)
- **US3** — [us3-apply-for-job-results.md](us3-apply-for-job-results.md)
- **US4** — [us4-save-remove-job-results.md](us4-save-remove-job-results.md)
- **US5** — [us5-report-job-results.md](us5-report-job-results.md)
- **INT** — [integration-results.md](integration-results.md)
- **MIG** — [migration-results.md](migration-results.md)
- **REL** — [release-results.md](release-results.md)
- **USE** — [usability-results.md](usability-results.md)

## Functional Requirement Trace

| Requirements  | Use case / class          | Tasks                      | Main implementation boundary                                        | Evidence / status                                  |
| ------------- | ------------------------- | -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| FR-001–FR-008 | UC-JOB-01 / Must          | T015-T023                  | Search normalization, public repository/service/API/page/components | US1, INT — PASS                                    |
| FR-009–FR-014 | UC-JOB-02 / Must          | T024-T031                  | Public detail repository/service/API/page/component                 | US2, INT — PASS                                    |
| FR-015–FR-018 | UC-JOB-03 / Should        | T043-T048                  | Saved repository/service/API/action                                 | US4, INT — PASS                                    |
| FR-019–FR-022 | UC-JOB-05 / Should        | T049-T055                  | Report repository/service/API/dialog                                | US5, INT — PASS                                    |
| FR-023–FR-030 | UC-APP-01 / Must          | T032-T042, T066            | Application policy/repository/service/APIs/form                     | US3, FND, INT — engineering PASS; provider BLOCKED |
| FR-031–FR-034 | Cross-cutting             | T007-T014, T056-T059, T066 | Contracts, request/session boundary, accessibility, architecture    | FND, US1-US5, INT — PASS automated                 |
| FR-035        | Cross-cutting performance | T060, T064                 | Performance harness and release evidence                            | REL — NOT RECORDED                                 |

## Use-Case Artifact Trace

| Story | Detailed behavior                                    | Contracts                                | Generated tests    | Result                   |
| ----- | ---------------------------------------------------- | ---------------------------------------- | ------------------ | ------------------------ |
| US1   | [US1 checklist](us1-browse-search-filter-results.md) | `GET /api/jobs`                          | 6 files / 16 tests | PASS                     |
| US2   | [US2 checklist](us2-view-job-details-results.md)     | `GET /api/jobs/{slug}`                   | 4 files / 8 tests  | PASS                     |
| US3   | [US3 checklist](us3-apply-for-job-results.md)        | application-form GET + applications POST | 5 files / 9 tests  | PASS; release dependency |
| US4   | [US4 checklist](us4-save-remove-job-results.md)      | saved-jobs PUT/DELETE                    | 2 files / 4 tests  | PASS                     |
| US5   | [US5 checklist](us5-report-job-results.md)           | reports POST                             | 3 files / 6 tests  | PASS                     |

## Success Criteria Trace

| Criterion                                     | Evidence                                | Status                                            |
| --------------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| SC-001 search/filter p95                      | Harness exists; qualifying run required | BLOCKED / not recorded                            |
| SC-002 detail/load p95                        | Harness exists; qualifying run required | BLOCKED / not recorded                            |
| SC-003 normalization and visibility           | US1 policy/integration tests            | PASS automated                                    |
| SC-004 first-attempt candidate usability      | USE                                     | BLOCKED at 0 participants                         |
| SC-005 duplicate/concurrent uniqueness        | US3, US4, US5                           | PASS automated                                    |
| SC-006 transaction rollback/outbox durability | US3                                     | PASS automated                                    |
| SC-007 cross-actor/private-data isolation     | FND, US1-US5                            | PASS automated                                    |
| SC-008 accessibility across five journeys     | Component/accessibility suites          | PASS automated; browser/manual qualification open |

## Scope and Release Matrix

| Scope                        | State                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| US1 Browse/Search (Must)     | Implemented and focused tests green                                         |
| US2 Details (Must)           | Implemented and focused tests green                                         |
| US3 Apply (Must)             | Implemented/tests green; retained-CV production producer blocked            |
| US4 Save/Remove (Should)     | Implemented and focused tests green                                         |
| US5 Report (Should)          | Implemented and focused tests green                                         |
| UC-JOB-04 Share              | Deliberate backlog; not silently added                                      |
| Single Feature 003 migration | Consolidated; executable DB verification blocked                            |
| Production release           | BLOCKED by MIG, provider, performance/usability and remaining release gates |

No Should feature may replace an incomplete Must story. No PASS in this trace
waives the constitution or converts Feature 004 temporary imports into retained
application documents.
