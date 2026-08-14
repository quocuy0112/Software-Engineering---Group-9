# Quickstart: In-App Notification Center

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x`
- Docker with the repository PostgreSQL service available
- Existing local environment initialized through `npm run env:init`
- No second development server holding `web/.next`

## Apply and Verify Data Changes

```powershell
npm run db:up
npm run db:validate
npm run db:generate --workspace @smarthire/web
npm run db:migrations:reconcile-names --
npm run db:deploy
npm run db:migrations:check
npm run notifications:migrate:legacy --workspace @smarthire/web
npm run notifications:migration:verify --workspace @smarthire/web
```

The migration verifier must report:

- unified notification table and indexes present;
- no duplicate deduplication keys;
- every unexpired legacy connection source row represented once;
- every converted recruitment work item represented for all authorized recipients;
- read timestamps and expiry bounds preserved;
- challenge/proof email kinds absent from notification data.

## Run Feature Validation

```powershell
npm run test:notifications --workspace @smarthire/web
npm run typecheck
npm run lint
npm run db:verify
npm run build
```

The feature test command covers shared contracts, policy, repositories, APIs, producer integration, email non-regression, UI, accessibility, architecture, security, and performance.

## Manual Local Check

```powershell
npm run dev
```

1. Sign in as a candidate and open the workspace notification bell.
2. Submit an application from another prepared account or fixture and confirm the candidate receipt appears without a new email.
3. Change an application stage as an authorized recruiter and confirm the candidate receives in-app while the existing email preference behavior is unchanged.
4. Send multiple messages in one conversation and confirm a bounded conversation notification appears.
5. Open the conversation successfully and confirm its badge and matching notifications clear.
6. Trigger a verification challenge email and confirm no token/proof notification appears.
7. Trigger a password-changed or admin account event and confirm both existing email and a safe in-app event are present.
8. Sign in as an administrator and verify the same bell/read behavior in the admin shell.
9. Attempt to request another user's notification identifier and confirm the API returns the same unavailable response as a missing identifier.

## Performance Check

```powershell
npm run perf:notifications --workspace @smarthire/web
```

Document environment, seeded row counts, warm-up, sample size, and P95 values. Required targets:

- committed event to visible notification: P95 at or below five seconds;
- unread-count API: P95 at or below 500 milliseconds;
- first 20-item page API: P95 at or below 500 milliseconds;
- context read convergence across two polling clients: P95 at or below five seconds.

## Validated Release Results

Validated on 2026-08-14 against local PostgreSQL and the production Next.js build:

- Prisma schema validation and generation passed.
- Migration sequence passed with 33 migrations from `001_identity_foundation` through `033_email_outbox_retention_fk_cleanup`; deploy reported no pending migrations after application.
- Idempotent legacy bridge rerun reported `migratedRows: 0` and `createdRecipients: 0` after the initial conversion.
- Migration verifier reported zero duplicate keys, missing connection rows, pending recruitment work, unsafe rows, and invalid retention rows.
- Notification performance used 5,000 retained rows, 5 warm-up samples, and 30 measured samples; list-page P95 was 17.11 ms and unread-count P95 was 7.74 ms against 500 ms targets.
- Feature notification suite passed 19 files and 36 tests.
- Affected job, messaging, connections, support, business-verification, admin-management, profile/account, and navigation-shell suites passed after Feature 016 integration fixes.
- TypeScript, full ESLint, Prisma gates, focused security/privacy/accessibility tests, and the optimized production build passed.
- The repository-wide parallel Vitest command was attempted and reached its 20-minute execution limit in unrelated pre-existing CV-import, image-search, architecture, salary-parser, and infrastructure tests; all failures attributable to Feature 016 were isolated, fixed, and rerun successfully.

## Email Non-Regression Check

- Existing email template files are not modified.
- Snapshot/render tests for all current email kinds remain unchanged.
- Existing recipient and preference integration tests pass.
- No new `EmailKind` or template is introduced for Feature 016.
- Verification, reset, recovery-proof, and company-email challenge links never appear in notification rows or API responses.

## Rollback

Roll back application code to the prior producer/read paths. Do not drop the additive unified table during emergency rollback. Legacy connection and recruitment tables remain present and read-only in the Feature 016 release, allowing controlled restoration without losing source data.
