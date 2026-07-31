# Sanitizer Dependency Gate

**Feature**: 002-candidate-profile-account-management  
**Executed**: 2026-07-31  
**Status**: PASS

## Environment

- Node.js: `v24.18.0`
- npm: `11.16.0`
- Root lockfile SHA-256:
  `7512820C40D564A44557F6597557E486DDCAC66CEAC6F7E9EBC175260248EDAD`
- Runtime dependency: `sanitize-html@2.17.6`
- Type dependency: `@types/sanitize-html@2.16.1`

## Blocking Evidence

- [x] `npm.cmd ls sanitize-html @types/sanitize-html --depth=0` resolved the
      exact approved pair through the sole root lockfile.
- [x] `npm.cmd exec --workspace @smarthire/web -- vitest run
    tests/backend/compatibility/sanitize-html-2.17.6.test.ts` passed all 11
      real-library compatibility, malformed-XSS, offline, Unicode, and
      server-only import checks.
- [x] `npm.cmd run typecheck` completed successfully with TypeScript 5.9.3.
- [x] `npm.cmd run build` completed the Next.js 16.2.11 production build.
- [x] `npm.cmd audit --json` reported 0 critical, 0 high, 0 moderate, 0 low,
      and 0 total vulnerabilities.

## Decision

The dependency gate is accepted. Feature 002 Foundation work may begin. Any
later dependency or lockfile change invalidates this evidence and requires the
gate to be rerun before release.
