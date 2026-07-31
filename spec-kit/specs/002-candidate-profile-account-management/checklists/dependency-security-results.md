# Dependency and Security Regression Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Runtime and exact dependency baseline

| Component              | Verified version | License    |
| ---------------------- | ---------------: | ---------- |
| Node.js                |          24.18.0 | runtime    |
| npm                    |          11.16.0 | runtime    |
| `sanitize-html`        |           2.17.6 | MIT        |
| `@types/sanitize-html` |           2.16.1 | MIT        |
| Better Auth            |           1.6.25 | MIT        |
| Prisma Client          |            7.9.0 | Apache-2.0 |
| Next.js                |          16.2.11 | MIT        |
| TypeScript             |            5.9.3 | Apache-2.0 |

Licenses and versions were read from the installed exact package metadata and
the sole root lockfile. Root `package-lock.json` SHA-256:
`7512820C40D564A44557F6597557E486DDCAC66CEAC6F7E9EBC175260248EDAD`.

The hash and sanitizer versions are unchanged from the pre-implementation T005
baseline.

## Executable gates

| Command                                                                                              | Result                                                                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm.cmd ls sanitize-html @types/sanitize-html better-auth @prisma/client next typescript --depth=0` | PASS - exact planned versions                                             |
| `npm.cmd run test:compatibility --workspace @smarthire/web`                                          | PASS - 6 files, 29 tests                                                  |
| `npm.cmd run typecheck`                                                                              | PASS - TypeScript 5.9.3                                                   |
| `npm.cmd run build`                                                                                  | PASS - Next.js 16.2.11 production build, all Feature 002 routes generated |
| `npm.cmd audit --json`                                                                               | PASS - 0 critical, high, moderate, low, or total vulnerabilities          |

The compatibility suite includes the 11-test malformed-XSS/server-only
sanitizer gate and Better Auth password/session compatibility. Prisma schema
validation/generation and clean/upgrade drift evidence are recorded in
`migration-results.md`.

## Baseline comparison and accepted risk

- T005 and release audit both report zero advisories.
- The exact sanitizer pair and root lock hash did not change after
  implementation.
- No new browser-public secret, session, JWT, or provider dependency exists.
- `sanitize-html` remains replaceable behind `PlainTextNormalizer`.
- No unreviewed critical/high finding or incompatible license is accepted.
