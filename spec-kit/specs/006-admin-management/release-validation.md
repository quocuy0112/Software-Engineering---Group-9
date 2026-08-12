# Feature 006 Release Validation

**Validation date**: 2026-08-11

**Branch**: `006-admin-management`

**Environment**: Local Windows workspace, PostgreSQL at `localhost:55432`,
Node.js 24.18.0, 16 logical CPUs, 29.86 GB RAM

This record separates executed automated evidence from manual or production
readiness checks. A skipped, unexecuted, or fixture-invalid journey is not
recorded as a pass.

## Phase 6 Email E2E Evidence

The suites were executed serially in dependency order with
`ADMIN_E2E_READY=1`: T056, then T074, then T097. Both desktop Chromium and the
320 px mobile project ran.

| Task                  | Result | Evidence                                                                                                                                                                                   |
| --------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T056 account security |   PASS | 6/6; real TOTP/step-up, stable operation ID across retry, suspend/reinstate content, revoke-one/revoke-all cardinality, provider success, permanent failure, and one alert across restart. |
| T074 verification     |   PASS | 6/6; encrypted filesystem storage, asynchronous SAFE/UNSAFE scanner, all seven event kinds, transient/permanent provider paths, and one winner for concurrent approval.                    |
| T097 membership       |   PASS | 4/4; exactly one company-scoped email per suspend/restore/remove, stale rejection, last-OWNER protection, and Candidate/multi-company isolation.                                           |

**Total**: 16/16 passed, 0 skipped.

## T140 Performance and Reliability Report

The target run used exactly 10 independent administrator sessions and a fixture
containing 10,000 accounts, 1,000 companies, 5,000 memberships, and 1,000 open
review items. It ran for 900,000 ms with one interaction per second per
administrator. The fixture cleanup removed all 10,000 fixture accounts after
measurement.

| Metric                              |                      Result |                        Target |
| ----------------------------------- | --------------------------: | ----------------------------: |
| Dashboard/list samples              |                       8,922 |                 15-minute run |
| p50 / p95 / p99                     | 157.75 / 311.64 / 663.62 ms |               p95 <= 2,000 ms |
| Maximum                             |                 2,000.36 ms | reported, not percentile gate |
| Usable within two seconds           |                     99.989% |                        >= 95% |
| Errors                              |                      0 (0%) |                          < 1% |
| Session enforcement p50 / p95 / max | 353.67 / 376.61 / 376.61 ms |              100% <= 2,000 ms |

The first unpaced diagnostic run intentionally remains documented: it generated
approximately 904,000 requests and failed with 98.34% connection/runtime errors.
The harness was corrected to model ten active administrators with an explicit
one-second interaction interval; no errors were excluded from the passing run.

Email reliability evidence came from 28 E2E deliveries and 48 provider
attempts across all 13 supported `eventKind` values.

| Reliability metric                     |                                                                                                        Result |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------: |
| Provider latency p50 / p95 / p99 / max |                                         0.0035 / 0.0058 / 0.0066 / 0.0066 ms (in-process controlled provider) |
| Retry count                            | `ACCOUNT_SUSPENDED=8`, `VERIFICATION_RECEIPT=4`, `VERIFICATION_EXPIRED=8`; all other covered event kinds `=0` |
| `MANUAL_INTERVENTION_REQUIRED`         |                                                                                                 2/28 (7.143%) |
| Commit-to-`SENT`                       |                                                                   24 samples; mean 5,813.46 ms; p95 12,480 ms |
| Revoke-all enforcement                 |                                                                                        4/4 within two seconds |

T140 also passed the focused Feature 006 suite: 55 files and 152 tests, including
qualification, 15/24/72-hour deadlines, worker resilience, contracts, security,
architecture, and performance thresholds.

## Automated Gates

| Gate                                 |                 Result | Evidence                                                                                                                       |
| ------------------------------------ | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript                           |                   PASS | `npm run typecheck`.                                                                                                           |
| Production build                     |                   PASS | 73 pages/routes generated.                                                                                                     |
| Focused Feature 006 suite            |                   PASS | 55 files, 152 tests.                                                                                                           |
| Email Phase 6 E2E                    |                   PASS | 16/16, no skip.                                                                                                                |
| OpenAPI/runtime drift                |                   PASS | 32 paths, version 0.2.0, drift false, SHA-256 `eee0a1d48d1e5a0b6a308d4545235a4f40620f527f4217c6c1045b08685d00a7`.              |
| Admin worker probe                   |                   PASS | Process exited successfully.                                                                                                   |
| Migration sequence/status            |                   PASS | 21 sequential migrations; local schema up to date.                                                                             |
| Fresh/upgrade migration verification |                   PASS | Docker fresh, Feature 001 upgrade, and Feature 004 upgrade/drift/constraint paths passed.                                      |
| Moderation migration parity          |                   PASS | legacy 0, generalized 0, missing 0.                                                                                            |
| Lint                                 | BLOCKED (pre-existing) | Only `profile-social-links-form.tsx:326` fails `react-hooks/rules-of-hooks`; all changed Feature 006 files pass targeted lint. |

The requested separate GitHub issue for the pre-existing lint defect could not
be created from this environment because GitHub CLI is not installed and no
connected browser session is available. The defect was not modified in this
change set.

## T144 Quickstart Acceptance

T144 was started only after T140 passed. The full admin Playwright directory was
executed without changing the out-of-scope T030/T112/T127/T138 tests. The run
is **not a pass**:

- 10 accessibility cases navigated to an undefined admin origin and rendered
  a 404 rather than an authenticated workflow.
- 2 moderation cases rendered the same 404 and did not exercise moderation.
- 2 signed-out authentication assertions failed because the expected regex is
  case-sensitive while the rendered heading is “Platform administrator sign
  in”.
- The 16 T056/T074/T097 cases retained their independent passing runs and no
  failure artifacts were produced for those suites.
- Recruiter boundary smoke cases produced no failure artifacts, but the full
  T127 controlled multi-company journey remains separately owned.

These failures are not patched here because T030/T112/T127/T138 are outside the
email-fix scope. Manual administrator/verification usability protocols and
NVDA/Firefox plus VoiceOver/Safari evidence also remain unexecuted.

## Production Readiness Blockers

`npm run admin:evidence:check` correctly failed closed in the local environment.
Missing production evidence includes exact HTTPS origins, named Legal/Security/
Operations approvals, a 32-byte evidence key, private scanner socket, enabled
delivery/worker configuration, fixed retention configuration, a private storage
root, and the company-access prerequisite owner/version/environment record.

## Release Decision

**NOT READY FOR RELEASE.** Phase 6 and T140 are complete and green. T144 remains
open because full authenticated accessibility/moderation/auth acceptance,
manual usability/screen-reader evidence, the pre-existing lint gate, and
production evidence-policy/prerequisite approvals are not complete.

## 2026-08-13 Support Center Extension

The Feature 006 Support Center increment is implementation-complete. It keeps
support data separate from Feature 008 private messaging, exposes only the
`SmartHire Support` identity to requesters, and gives administrators access only
to support cases through the existing PlatformAdministrator boundary.

| Gate                        |                 Result | Evidence                                                                                                                                                         |
| --------------------------- | ---------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema/generation    |                   PASS | `prisma format`, `prisma validate`, and Prisma Client generation completed.                                                                                      |
| Migration deployment/status |                   PASS | `20260813090000_support_center` deployed; 25 migrations and local schema up to date.                                                                             |
| OpenAPI/runtime drift       |                   PASS | 38 reviewed paths, version 0.3.0, drift false, SHA-256 `1e5a925424bccc2314c3d08b59b217a3b5969c156e06252624102125ffb165a0`.                                       |
| TypeScript                  |                   PASS | `npm run typecheck`.                                                                                                                                             |
| Support lint scope          |                   PASS | New Support routes, backend, UI, contracts, and tests pass ESLint.                                                                                               |
| Support tests               |                   PASS | 7 files and 17 tests, including repository transactions, contract, privacy, architecture, components, and accessibility.                                         |
| Feature 006 regression      |                   PASS | 55 files and 154 tests. One provider-notification case was flaky in the first aggregate run, then passed 4/4 in isolation and the complete rerun passed 154/154. |
| Feature 008 regression      |                   PASS | 28 files and 66 tests.                                                                                                                                           |
| Admin worker probe          |                   PASS | Worker runtime, including the Support lifecycle loop, exited successfully.                                                                                       |
| Production build            |                   PASS | Next.js compiled and generated 75 routes/pages, including requester and administrator Support routes.                                                            |
| Repository-wide lint        | BLOCKED (pre-existing) | Two Profile files outside this increment fail React hook rules; all Support files pass targeted lint.                                                            |
| Repository-wide format      | BLOCKED (pre-existing) | 242 previously unformatted files outside this increment fail the global check; all changed non-generated Support files pass targeted formatting.                 |

The final boundary audit confirms requester ownership predicates on every read
and write, current-assignee enforcement for replies and lifecycle actions, a
database-enforced single active assignment, content-free realtime/email events,
no dependency that reads ordinary Feature 008 messages, bounded worker batches,
and exact-time content suppression/deletion. `.claude/settings.local.json` is a
local untracked file and is explicitly excluded from staging and commits.
