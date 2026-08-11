# Feature 006 Release Validation

**Validation date**: 2026-08-10  
**Branch**: `006-admin-management`  
**Environment**: Local Windows development workspace, PostgreSQL at
`localhost:55432`

This record distinguishes implemented automated coverage from release journeys
that require controlled identities, external approvals, or production-like
infrastructure. A skipped or unexecuted journey is not recorded as a pass.

## Automated Gates

| Gate | Result | Evidence |
|---|---:|---|
| TypeScript typecheck | PASS | `npm run typecheck` completed with no diagnostics. |
| Lint | PASS | `npm run lint` completed with no diagnostics. |
| Production build | PASS | `npm run build` compiled, typechecked, and generated 72 routes/pages. |
| Feature 006 focused suite | PASS | `npm run test:admin-management -- --reporter=verbose`: 48 files and 106 tests passed. |
| OpenAPI/runtime drift | PASS | `npm run admin:contracts`: 32 paths, version 0.2.0, `drift=false`, SHA-256 `097a7ed2ba500787a98f431a3687cd3002f7fea28eaadf73a400c1b82b264bdd`. |
| Admin worker probe | PASS | `npm run admin:worker:probe` exited successfully. |
| Moderation migration parity | PASS | `npm run admin:moderation:migration:verify`: legacy 0, generalized 0, missing 0. |
| Prisma schema and migration history | PASS | `npm run db:migrations:check`, `npm run db:verify`, `npm run db:status`, and `npm run db:deploy`: sequential `001`–`020` naming, fresh/upgrade paths and drift checks passed, local history reconciled by checksum, and no migration is pending. |
| Dependency advisories | PASS | `npm audit --json --package-lock-only`: 0 vulnerabilities at every severity. |
| Performance evaluator | PASS (self-test only) | 100 samples, 0 errors, p95 250 ms, usable-within-two-seconds rate 100%. This is not the target-environment SC-002 run. |
| Scope boundary | PASS | Included in the focused suite; no excluded Recruiter Manager, deletion, grant UI, automated enforcement, AI decision, or export surface detected. |

The protected-evidence pipeline is included in the focused result: encrypted
private storage, real scanner abstraction, magic-type validation, structural
decode, normalized server-side preview, authorization checks, and public-locator
privacy tests passed. PDF/native rendering is kept outside browser bundles.

## Release Journeys and Manual Evidence

| Journey/evidence | Result | Required follow-up |
|---|---:|---|
| Authenticated Feature 006 Playwright journeys | NOT RUN | Provision the section 4 identities and set `ADMIN_E2E_READY=1`. The suite defines 13 desktop tests; 11 stateful tests remain fixture-gated. |
| Unauthenticated Playwright smoke tests | BLOCKED | Playwright resolves the tests, but the expected Chromium headless executable is unavailable in the managed runtime even after `playwright install chromium` returned success. Re-run on an agent with a writable Playwright browser cache. |
| Full 15-minute, 10-admin performance run | NOT RUN | Supply `ADMIN_PERF_ORIGIN`, `ADMIN_PERF_AUTH_COOKIE`, and the representative dataset, then run `npm run perf:admin-management`. |
| Administrator two-minute usability protocol | NOT RUN | Execute `web/tests/usability/admin-management/account-security-protocol.md` with representative administrators. |
| Verification three-minute usability protocol | NOT RUN | Execute `web/tests/usability/admin-management/verification-review-protocol.md`. |
| NVDA/Firefox and VoiceOver/Safari smoke | NOT RUN | Execute `web/tests/accessibility/admin-management/manual-screen-reader-protocol.md` and attach the completed evidence sheets. |
| Evidence policy approvals/readiness | BLOCKED | Named Legal, Security, and Operations approvals plus production storage/scanner/encryption/retention configuration have not been supplied. `npm run admin:evidence:check` must fail closed until they are present. |
| Existing-company prerequisite | BLOCKED | Record the upstream owner, contract version, environment, and passing integration evidence in `docs/dependencies/company-access-prerequisite.md`. Existing-company approval remains disabled until ready. |
| Feature 004 Docker compatibility gates | BLOCKED | Local Docker/ClamAV/Docker Scout access is unavailable. These repository-wide checks are outside Feature 006 but remain mandatory for a release. |
| Entire repository `npm test` | FAIL / PRE-EXISTING | The run exceeded 300 seconds and reported unrelated CV-retention, profile-account, Docker/ClamAV, and legacy architecture failures. Feature 006's focused suite passed independently; repository-wide release remains blocked until owners resolve or re-baseline those failures. |

## SC-001–SC-018 Evidence Status

- SC-001, SC-003–SC-007, SC-009–SC-013, and SC-015–SC-018 have passing
  deterministic contract, unit, integration, security, concurrency, or worker
  evidence in the focused suite.
- SC-002 has a passing evaluator self-test, but the required target-environment
  15-minute run is not complete.
- SC-008 requires the unexecuted three-minute verification usability protocol.
- SC-014 has passing component-level automated accessibility checks; its full
  keyboard Playwright and manual screen-reader evidence is not complete.

## Release Decision

**NOT READY FOR RELEASE.** Implementation and focused automated gates are
green, but the authenticated browser journeys, target-environment performance
run, manual usability/accessibility evidence, evidence-policy approvals, and
upstream prerequisite readiness must be completed before T144 can be closed.
