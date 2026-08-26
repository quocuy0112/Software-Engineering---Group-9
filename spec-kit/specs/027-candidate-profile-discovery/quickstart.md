# Quickstart: Candidate Profile Discovery and Recruiter Review

## Prerequisites

1. Use PostgreSQL with repository migrations applied.
2. Create two active Candidates plus an active verified company, eligible recruiter membership, active/closed job, and one submitted application with CV/contact snapshot.

## Validate schema and migration

From `web/` after implementation:

```powershell
npm.cmd run db:validate
npm.cmd run db:migrations:check
node scripts/verify-candidate-profile-discovery-migration.mjs
npm.cmd run typecheck
```

Expected: schema validates, sequence includes `066_candidate_profile_discovery`, migration verifier and typecheck pass.

## Candidate flow

1. Target Candidate enables exact-ID discovery and selects Candidate-only headline/skills.
2. Another Candidate visits `/connections`, enters the full target account ID, receives one compact result, and sees only those sections after opening it.
3. Target turns discovery off; repeat lookup and an unknown-ID lookup. Both must show the same neutral unavailable result.
4. Submit name, email, or partial ID and confirm no directory search occurs.
5. Exercise minute/hour limits with controlled fixtures; confirm safe retry feedback without target disclosure.

## Recruiter flow

1. Candidate submits with contact consent and a Recruiter-visible live section.
2. Authorized recruiter opens `/recruiter/candidates/<jobId>`, selects `View candidate profile`, and sees labelled snapshot/live sections plus submitted documents.
3. Candidate hides the live section and withdraws contact consent. Reopen view: live section/contact are absent; authorized snapshot remains.
4. Use another company, missing membership, or wrong job ID; confirm no profile/contact/document disclosure.

## Automated verification

```powershell
npm.cmd run test:profile-account
npm.cmd run test:applications
npm.cmd run test:connections
npm.cmd run test:connections:e2e
npm.cmd run build
```

Add focused feature tests across profile, application, connections, security, accessibility, and E2E suites.
