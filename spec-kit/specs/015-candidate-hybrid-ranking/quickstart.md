# Quickstart: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

## Prerequisites

1. Complete Feature 012 Group 1 migration and its application/document quickstart.
2. Configure a test PostgreSQL database, private document fixtures, worker runtime, notification fake, and both successful/failing fake AI adapters.
3. Apply the Feature 015 migration and start the web application plus scoring worker.
4. Seed one authorized Recruiter/job with deterministic JD v3/config `HS-60-40-v1`, representative applications, and the same 10,000-row job profile used by Group 1 performance evidence.

## 1. Validate deterministic scoring with AI down

1. Configure the AI adapter to time out or open its circuit.
2. Submit/score a CV containing known required/missing skills and experience evidence.
3. Open the scoring detail.
4. Verify automatic score and extraction are complete, AI is exactly `Unavailable`, final is exactly `Not calculated`, no zero/partial hybrid is present, and retry is allowed.
5. Verify evidence excerpts/page-or-section references and CV/JD/parser/config versions reproduce the fixture result.

**Expected evidence**: deterministic assertions pass independently of provider calls; logs contain only safe failure/correlation codes.

## 2. Validate successful AI and hybrid scoring

1. Configure the fake provider to return a schema-valid score 88/confidence 82 for automatic score 92.
2. Wait for asynchronous publication and read detail.
3. Verify final 89.6 and exact formula `92 × 0.4 + 88 × 0.6 = 89.6`.
4. Verify provider/model/prompt/policy lineage, summary, three breakdown lines, strengths, points to verify, sensitive-attribute exclusion, and questions linked to verification points.
5. Repeat with confidence 69 and insufficient question evidence.

**Expected evidence**: low confidence has a text caution without score/stage change; insufficient data has a non-empty fallback.

## 3. Validate malformed AI and parser warnings

1. Return malformed/provider-schema-invalid output and confirm it resolves to deterministic fallback without raw output persistence.
2. Score fixtures with `PARSED_WITH_ERRORS` and `FAILED` CV/JD status.
3. Verify parser version/time/snapshot is visible and every affected score projection carries `mayBeIncomplete` and a textual warning.

**Expected evidence**: no fabricated skill/year/question appears, and deterministic safe evidence remains usable where present.

## 4. Validate rescore continuity and priority preservation

1. Publish full results for several applications and set one manual priority with a reason.
2. Keep that candidate drawer open and record its current result ID.
3. Confirm a job rescore against a newer config/JD version.
4. Verify the command returns `202` immediately; list/drawer retain old scores plus rescore indicator.
5. Complete the worker and verify each full successor appears atomically, the drawer does not blank/grey, and priority/value/reason/history are unchanged.

**Expected evidence**: no partial aggregate is observable and only scoring generations change.

## 5. Validate partial and zero-item rescore

1. Configure candidate A AI success, candidate B AI timeout, and candidate C item failure before safe publication.
2. Run and complete the batch.
3. Verify A publishes full result, B publishes new deterministic fallback, C retains prior published result, and batch reports accurate success/deterministic-only/failure counts.
4. Run against an authorized job with zero applications.

**Expected evidence**: first batch is `COMPLETED_WITH_FAILURES`; zero-item batch is `COMPLETED` with zero counts and an audit event.

## 6. Validate per-candidate AI retry

1. From an `Unavailable` result, confirm retry with an idempotency key.
2. Verify response is pending, the same automatic-result ID remains visible, and duplicate replay does not enqueue work.
3. Complete success and failure paths; after three consecutive failures verify support guidance.

**Expected evidence**: deterministic computation invocation count does not increase.

## 7. Validate manual-priority concurrency

1. Set each of `HIGH`, `NORMAL`, `LOW`, and `HOLD` with non-blank reason and inspect actor/time/version.
2. Submit two writes using the same expected version.
3. Verify exactly one wins and the loser receives conflict with no overwrite.
4. Remove the active priority with a removal reason and inspect immutable history.

**Expected evidence**: one active-row constraint holds and scores remain byte-for-byte unchanged.

## 8. Validate interview decision

1. Confirm transition from each allowed source stage using expected version and idempotency key.
2. Verify `JobApplication.stage=INTERVIEWING`, one canonical stage event, one structured audit event, and one unique notification intent in one commit.
3. Process delivery and verify notification status becomes `SENT` exactly once.
4. Attempt from `REJECTED` and other disallowed stages.

**Expected evidence**: invalid sources create no write; valid response updates list state without reload and includes actor/time/event/audit/notification status.

## 9. Validate reject decision

1. Submit without reason and verify no mutation.
2. Confirm with each allowlisted reason and an optional internal note.
3. Verify canonical `REJECTED` stage, stage event, audit actor/time/reason, and no candidate notification.
4. Search candidate-facing APIs/notification payloads for the internal note.
5. Race reject against interview with the same expected stage version.

**Expected evidence**: the note never appears candidate-side; exactly one raced command commits.

## 10. Validate score filtering and status semantics

1. Combine score 80–100, required skill, experience, stage, and scoring-status filters.
2. Verify typed removable chips reflect all active conditions.
3. Include rows in `Processing`, `Unavailable`, and `Not calculated` states.
4. Verify score range excludes all without final score, returns the exact `processingExcludedCount` and explanatory label, and never orders them as zero.
5. Verify default `ACTIVE_PIPELINE` explicitly reports rejected exclusion and `ALL`/`REJECTED` retrieves them.

**Expected evidence**: all codes have text labels/icons; no color-only state exists.

## 11. Validate pagination across mid-browse rescore

1. Traverse the 10,000-row fixture in final-score order and retain ranking snapshot/cursors.
2. Complete a score-reordering rescore after page 2.
3. Continue the old traversal and compare application IDs to its frozen expected snapshot.
4. Start a fresh traversal and verify new order.
5. Change page size from 25 to 100 and verify an incompatible old cursor is not silently reinterpreted.

**Expected evidence**: zero duplicate/missing IDs in either traversal; cursor tampering/job/filter mismatch returns a safe bounded error.

## 12. Validate 10,000-row performance and resilience evidence

1. Use the same representative job/data profile as Group 1, with documented distributions of scored/unavailable/processing/stage/skill/experience rows.
2. Measure initial and subsequent ranked/filter pages, rescore command acceptance, worker throughput, full-batch completion, per-item AI latency, and error isolation.
3. Record environment, dataset construction, warm-up, sample size, test duration, concurrency, worker concurrency, provider condition, nearest-rank P50/P95/P99/max, error rate, throughput, and final outcome counts.
4. Confirm ranked/filter page and command-acceptance P95 ≤2 seconds and asynchronous AI P95 ≤20 seconds under normal conditions.

**Expected evidence**: a reproducible report, raw test summary, and zero pagination-integrity or cross-tenant failures accompany the build.

## 13. Run focused and regression suites

```powershell
Set-Location web
npm run test -- --runInBand tests/shared/scoring tests/backend/scoring tests/security/scoring tests/frontend/scoring
npm run test:e2e -- scoring-ranking-decisions
npm run build
```

Verify Group 1 submission, original CV/cover-letter viewer, retention, authorization, chronological list, and application-stage tracking regression suites remain green.
