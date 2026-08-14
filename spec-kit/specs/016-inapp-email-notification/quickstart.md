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
npm run db:generate
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

## Email Non-Regression Check

- Existing email template files are not modified.
- Snapshot/render tests for all current email kinds remain unchanged.
- Existing recipient and preference integration tests pass.
- No new `EmailKind` or template is introduced for Feature 016.
- Verification, reset, recovery-proof, and company-email challenge links never appear in notification rows or API responses.

## Rollback

Roll back application code to the prior producer/read paths. Do not drop the additive unified table during emergency rollback. Legacy connection and recruitment tables remain present and read-only in the Feature 016 release, allowing controlled restoration without losing source data.
