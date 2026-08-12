# Release validation — Smart Hire Home

**Feature status**: In Progress — implementation usable, release evidence incomplete  
**Release-ready**: No  
**Reconciled**: 2026-08-12  
**Task ledger**: 75/81 complete; 6 evidence-gated tasks remain open

## Implementation conclusion

Feature 010 is implemented and the shared Home page runs for guest, candidate,
and employer presentations. The focused TypeScript, lint, unit, integration,
component, accessibility, security, and architecture gates pass. No additional
test execution will be performed in this close-out, per user direction.

The feature is suitable for local use and demonstration. It is not declared
release-ready because the incomplete browser, performance, moderated usability,
manual visual/accessibility, and repository-wide evidence below remains open.

## Automated evidence actually produced

| Date | Command | Result | Evidence |
| --- | --- | --- | --- |
| 2026-08-12 | `npm --prefix web run typecheck` | Pass | TypeScript completed with exit code 0. |
| 2026-08-12 | `npm --prefix web run lint:home` | Pass | Focused Home ESLint completed with exit code 0. |
| 2026-08-12 | `npm --prefix web run test:home` | Pass | 32 test files and 79 tests passed. Performance and Playwright were not included. |
| 2026-08-12 | `npm --prefix web run test:home:e2e` | Blocked | Default server startup requires Docker; the environment returned `spawn docker ENOENT`. |
| 2026-08-12 | `PLAYWRIGHT_APP_ONLY=1; npm --prefix web run test:home:e2e` | Partial | 23 tests passed, 5 failed, and 2 provider-fault cases remained intentionally skipped before the 300-second command timeout. Guest search, Trending/Smart Match, employer/community, localization, and responsive keyboard scenarios produced passing browser evidence. Session/resilience coverage remains open. Test-only corrections were made for bounded-job and compact-menu assumptions but were not rerun by user direction. |
| 2026-08-12 | `npm --prefix web run lint` | Fail outside Feature 010 | Two existing React lint errors remain in Profile components: `account-preferences-form.tsx` and `profile-social-links-form.tsx`. Focused Home lint remains passing. |

## Open release evidence

- **T031**: Complete session-aware Home E2E evidence, including candidate logout,
  expiry, and employer behavior across configured browser projects.
- **T070**: Complete independent provider-failure/recovery E2E evidence using an
  existing supported fault-injection boundary; Feature 010 must not add a test API.
- **T075**: Run the separate Home performance command against at least 1,000
  active public jobs with 10 concurrent visitors and at least 100 measured
  samples per required viewport.
- **T077**: Conduct the moderated first-visit study with at least 10 job seekers
  and 10 eligible employers.
- **T078**: Complete and sign off the bilingual desktop/tablet/mobile/200% zoom
  manual visual and accessibility review.
- **T080**: Produce a fully passing targeted Home E2E run and the required full
  repository lint, non-performance Vitest, and default Playwright regression evidence.

## Scope conclusion

The implementation remains within Feature 010 boundaries: one shared Home
composition, existing authentication/session/logout/save/recruiter/job-discovery
flows, a read-only public company projection, deterministic candidate-facing job
recommendation reuse, centralized bilingual Home copy, and display-only curated
content. It adds no Home API, database migration, persistent recommendation,
applicant-screening engine, CMS, social interaction, payment, chat, or recruitment
workflow.

No open item above is inferred as passed from focused tests. Release readiness
must remain **No** until the six open tasks have their named evidence.
