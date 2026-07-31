# Feature 002 final release regression

Date: 2026-07-31  
Status: **PASS — executable regression gate complete**

The gate ran from the repository root on Windows 10.0.26200 x64 with Node.js
24.18.0, npm 11.16.x, PostgreSQL 16.12 in the repository Compose service,
Prisma 7.9.0, Next.js 16.2.11, and capture email. No secret values, profile
bodies, recipients, proofs, cookies, session/CSRF values, raw network values,
or provider/database error bodies were emitted by the final commands.

T141 covers executable release regression only. The live assistive-technology
observations in T136 and representative participant study in T137 remain
separate, explicitly open human-evidence gates.

## Final command matrix

| Gate                                                               | Command                                                                                                      | Final result                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Format                                                             | `npm.cmd run format --workspace @smarthire/web`                                                              | PASS — all source-owned matched files use Prettier style                                                                               |
| Diff hygiene                                                       | `git diff --check -- . ':(exclude)web/src/backend/generated/prisma/**' ':(exclude)web/tsconfig.tsbuildinfo'` | PASS — no source-owned whitespace errors                                                                                               |
| Environment                                                        | `npm.cmd run env:check`                                                                                      | PASS — Node/npm, Docker/Compose, healthy PostgreSQL, local files, workspace, trusted-proxy, server-only email, and Prisma connectivity |
| Prisma schema                                                      | `npm.cmd run db:validate`                                                                                    | PASS — schema valid                                                                                                                    |
| Prisma generation                                                  | `npm.cmd run db:generate --workspace @smarthire/web`                                                         | PASS — Prisma Client 7.9.0 generated                                                                                                   |
| Migration status                                                   | `npm.cmd run db:status --workspace @smarthire/web`                                                           | PASS — 9 migrations found; database schema up to date                                                                                  |
| Migration verification                                             | `npm.cmd run db:verify`                                                                                      | PASS — fresh apply/connectivity/drift and Feature 001 upgrade/profile backfill/constraints                                             |
| Lint                                                               | `npm.cmd run lint`                                                                                           | PASS — zero errors and zero warnings                                                                                                   |
| TypeScript                                                         | `npm.cmd run typecheck`                                                                                      | PASS                                                                                                                                   |
| Unit/contract/integration/compatibility/architecture/accessibility | `npm.cmd test`                                                                                               | PASS — 123 files, 527 tests                                                                                                            |
| Production build                                                   | `npm.cmd run build`                                                                                          | PASS — optimized Next.js build, type validation, and 49 routes                                                                         |
| System E2E                                                         | `npm.cmd run test:e2e`                                                                                       | PASS — 40/40 serial tests in 5.7 minutes                                                                                               |

The formatter excludes only downloaded `.local` browser binaries, build/test
artifacts, dependencies, lock output, and the Prisma-generated client.
Generator-owned Prisma output is regenerated from the validated schema rather
than hand-formatted. Its upstream generated comments contain trailing spaces,
so the separate diff-hygiene command excludes that directory and
`tsconfig.tsbuildinfo`; all owned source and documentation remain checked.

## E2E coverage

The final browser run used one worker and the repository-managed application,
PostgreSQL, and capture worker:

- 20/20 desktop Chromium journeys passed;
- 20/20 Chromium journeys at 320 by 720 CSS pixels passed;
- all four Feature 002 story journeys passed in both projects;
- registration, login/rate-limit, verification, recovery, session, TOTP,
  navigation, responsive-shell, and public-home regressions passed; and
- the only server warnings were four intentional Better Auth `Invalid
password` outcomes exercised by negative credential tests.

## Gate remediation record

The initial format command failed because it traversed downloaded Playwright
browser assets and generator-owned Prisma output, while the repository also
contained unformatted owned files. `.local` and the generated client were added
to the formatter ignore boundary, all owned application/test files were
formatted, and the repository format command then passed.

The first environment check observed Compose PostgreSQL before its health
status was available. `npm.cmd run db:up` and `npm.cmd run db:status` confirmed
the existing service as healthy; the unchanged environment check then passed.

The first lint run found:

- downloaded Chromium scripts outside source ownership;
- intentional control-character regexes;
- two caught-error transformations;
- a redundant password-operation assignment;
- four React effect/ref patterns;
- test-only regex/escape style; and
- one React Hook Form compiler warning.

The fixes added the downloaded-asset ignore, replaced control regexes with
explicit code-point checks, preserved original database failures without
attaching raw causes to safe symptom errors, used the existing typed profile
validation error, removed the redundant assignment, made effects/ref access
React-safe, replaced `watch` with `useWatch`, and corrected the tests. The final
lint run has zero findings.

The first full Vitest run passed 122 files/526 tests and found one component
test resolving a mocked fetch before the new lint-safe scheduled request was
created. The test now waits for the observable fetch call. A focused 6-file,
29-test regression passed, followed by the definitive 123-file/527-test run.

## Referenced release evidence

- `migration-results.md`: clean/upgrade migration and forward-fix evidence.
- `dependency-security-results.md`: dependency/license/audit compatibility.
- `integration-results.md`: prior full PostgreSQL suite and redaction scan.
- `e2e-results.md`: story and regression journey details.
- `performance-results.md`: required 100-sample performance/session evidence.
- `accessibility-results.md`: 33 automated checks and the open live audit
  matrix.
- `usability-study.md`: ready protocol and explicitly unexecuted participant
  matrix.

The protected existing migration
`web/prisma/migrations/20260731025418_test_ready/` was not edited.
