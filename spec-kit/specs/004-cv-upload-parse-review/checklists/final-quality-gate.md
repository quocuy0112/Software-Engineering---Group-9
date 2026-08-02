# Feature 004 Final Quality Gate

**Recorded:** 2026-08-02  
**Engineering validation:** **PASS**  
**P0 production release:** **BLOCKED**

All local validation used PostgreSQL 16.12 database
`cv_phase8_final_gate_20260802_01`, with both `DATABASE_URL` and `DIRECT_URL`
overridden and `TZ=UTC`. Migrations 001 through 008 were applied from `web/`.
The shared `smarthire` database was not reset, rolled back, or used for test
fixtures.

## Reproducible Results

| Gate                                     | Command or evidence                                                                                                                                                | Result                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                               | `npm.cmd run format` from `web/`                                                                                                                                   | PASS: all files matched Prettier, 24.5 seconds                                                                                                                                                                   |
| ESLint                                   | `npm.cmd run lint` from `web/`                                                                                                                                     | PASS: no findings, 29.3 seconds                                                                                                                                                                                  |
| TypeScript                               | `npm.cmd run typecheck` from `web/`                                                                                                                                | PASS: `tsc --noEmit`, 28.3 seconds                                                                                                                                                                               |
| Complete Feature 004 Vitest gate         | `npm.cmd run test:cv-import -- --pool=forks --no-file-parallelism --maxWorkers=1`                                                                                  | PASS: 54/54 files, 350 passed, 2 safely skipped, 352 total, 302.22 seconds                                                                                                                                       |
| Real Route Handler session matrix        | Included in the complete Vitest gate through `cv-route-session-boundary.test.ts`                                                                                   | PASS for upload reservation/content, status, draft GET/PATCH, and confirmation across valid, missing, idle-expired, absolute-expired, logout/revoked, and password-reset-revoked sessions                        |
| Serial controlled-state Playwright group | Consent/retention, failure/retry, multi-device conflict, and review/confirm specs; `--workers=1`, desktop and 320-pixel projects                                   | PASS: 10/10, 134.8 seconds                                                                                                                                                                                       |
| Serial real-pipeline Playwright group    | Full uninterrupted journey and upload-to-generated-draft specs; real Compose worker, `--workers=1`, desktop and 320-pixel projects                                 | PASS: 6/6, 93.5 seconds                                                                                                                                                                                          |
| Production build                         | `npm.cmd run build`                                                                                                                                                | PASS: compiled in 8.1 seconds, typechecked in 22.1 seconds, generated 50 pages, 39.3 seconds total                                                                                                               |
| Local environment/configuration          | `npm.cmd run env:check`                                                                                                                                            | PASS: Node/npm, Compose, PostgreSQL, private local storage, artifact key, fixed limits, ClamAV socket, parser model, explicit approvals, root/web agreement, and Prisma connectivity; no secret values displayed |
| Dependency versions and licenses         | `dependency-and-infrastructure.test.ts` plus `npm.cmd ls ... --workspace @smarthire/web --depth=0`                                                                 | PASS: the seven reviewed packages exactly match the versions and licenses in the dependency evidence                                                                                                             |
| npm advisory review                      | The 7/7 dependency/infrastructure compatibility gate included `npm audit --json --package-lock-only`                                                               | PASS: 0 high and 0 critical advisories. A duplicate standalone registry call was blocked before execution by workspace data-egress policy and was not treated as contrary evidence                               |
| Container/topology scan                  | The 7/7 dependency/infrastructure compatibility gate checks both pinned images with Docker Scout, worker probe, socket ownership, and lack of scanner TCP exposure | PASS locally: 0 high and 0 critical findings for the reviewed ClamAV and current worker images                                                                                                                   |
| ClamAV configuration                     | Compatibility/integration tests and live local Unix-socket checks                                                                                                  | PASS locally: ClamAV 1.4.5, fresh-signature gate, fixed `/run/clamav/clamd.sock`, EICAR behavior, and no scanner TCP listener                                                                                    |
| S3 configuration                         | `s3-retention-policy.test.ts`, storage readiness, and production fail-closed environment checks                                                                    | Automated PASS; no live production bucket/KMS evidence                                                                                                                                                           |
| OpenAI configuration                     | OpenAI adapter/dispatch tests, immutable snapshot check, consent checks, and custom-endpoint rejection                                                             | Automated PASS; optional live synthetic test skipped safely because an approved project was unavailable                                                                                                          |
| P0 route exposure                        | Architecture tests, production bundle, and `.next/server/app-paths-manifest.json`                                                                                  | PASS: only import, content, status/delete, consent, retry, draft, and confirm CV routes exist; no original-CV preview/retrieval/download route exists                                                            |
| Accessibility                            | Complete Vitest accessibility suites plus both 320-pixel Playwright projects                                                                                       | PASS automated axe, contrast, keyboard, focus, status announcement, reduced-motion, and 320-pixel checks                                                                                                         |
| Migration                                | [Migration results](migration-results.md)                                                                                                                          | PASS on clean PostgreSQL and forward migration from 001-007, including constraints and rollback-safety review                                                                                                    |
| Measured local performance               | [Performance results](performance-results.md)                                                                                                                      | PASS under documented local conditions; production qualification remains blocked                                                                                                                                 |
| Representative-user usability            | [Usability results](usability-results.md)                                                                                                                          | BLOCKED: 0/30 required participant observations                                                                                                                                                                  |

The serial Playwright split is intentional. Controlled-state tests ran with
stage processing disabled but cleanup enabled so seeded queued records could
not race the real worker. Pipeline tests then ran with the real worker enabled.
Together the two groups cover all 16 desktop/mobile test instances without
parallel database or worker interference.

## Production Control Evidence

| Required production control                                                                             | Evidence status                                                                                                                    | Release result                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Trusted ingress/proxy TLS termination                                                                   | No deployed ingress output or approved evidence link is present                                                                    | BLOCKED                                        |
| HTTP-to-HTTPS redirect                                                                                  | No deployed redirect probe is present                                                                                              | BLOCKED                                        |
| Approved HSTS policy                                                                                    | No deployed response-header evidence is present                                                                                    | BLOCKED                                        |
| Secure-cookie and origin preservation through the proxy                                                 | No production session/cookie/origin probe is present                                                                               | BLOCKED                                        |
| Allowlisted HTTPS OpenAI endpoint; custom/non-HTTPS overrides rejected                                  | Rejection and immutable endpoint behavior pass automated tests; no approved production deployment observation exists               | BLOCKED for deployment                         |
| Private, non-versioned S3 with Block Public Access, customer SSE-KMS, bucket key, and bounded lifecycle | Fail-closed policy gate passes automated tests; no sanitized production readiness output exists                                    | BLOCKED                                        |
| Workload/role credentials rather than static application secrets                                        | Enforced by production environment validation; no production identity evidence exists                                              | BLOCKED                                        |
| ClamAV check from inside the production worker pod                                                      | Local Compose socket/probe passes; no production in-pod `cv:scanner:check` evidence exists                                         | BLOCKED                                        |
| OpenAI DPA, Vietnamese cross-border assessment, ZDR, approved project, and synthetic-only live smoke    | Dispatch fails closed in code; organizational identifiers and live smoke evidence are absent                                       | BLOCKED; external parsing must remain disabled |
| Production-qualified performance run                                                                    | Local measured gate passes, but Next production, S3/KMS, approved OpenAI, provider network, and near-5 MB input were not exercised | BLOCKED                                        |
| Representative moderated usability study                                                                | Predeclared protocol exists, but no participant study was run                                                                      | BLOCKED                                        |
| Production backup/restore and operational recovery evidence                                             | No production restore exercise is linked                                                                                           | BLOCKED                                        |

The fixed endpoint and absence of an original-CV retrieval route are code and
build facts. They do not substitute for deployed HTTPS/ingress evidence.

## Linked Evidence

- [Foundation results](foundation-results.md)
- [US1 upload/safe-draft results](us1-upload-safe-draft-results.md)
- [US2 review/confirm results](us2-review-confirm-results.md)
- [US3 failure/recovery results](us3-failure-recovery-results.md)
- [US4 multi-device results](us4-multi-device-results.md)
- [US5 consent/retention results](us5-consent-retention-results.md)
- [Dependency and infrastructure gate](dependency-infrastructure-gate.md)
- [Production provider gates](production-provider-gates.md)
- [Migration results](migration-results.md)
- [Performance results](performance-results.md)
- [Usability results](usability-results.md)

## Release Decision

The implementation, isolated database validation, local provider boundaries,
serial journeys, and production build are green. P0 release remains blocked
until every production-control row above has approved evidence and the
usability and production-qualified performance gates pass. No waiver or live
provider claim is recorded.
