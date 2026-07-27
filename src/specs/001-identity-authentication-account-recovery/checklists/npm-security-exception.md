# Resolved npm security exceptions

- [x] `npm audit --json` was rerun on 2026-07-27 without `--force`.
- [x] Current result: 0 critical, 0 high, 0 moderate, 0 low.
- [x] Better Auth and its Prisma adapter use 1.6.25, above the 1.6.22 fix for GHSA-qq9h-g4jm-xgf3.
- [x] The 1.6.25 PostgreSQL compatibility suite passes 16/16 with the reviewed `failedVerificationCount`/`lockedUntil` schema migration.
- [x] Next.js 16.2.11, PostCSS 8.5.22, and sharp 0.35.3 remove the prior Next.js dependency-chain findings.
- [x] Prisma CLI/client/adapter-pg remain at 7.9.0 while patched `find-my-way` 9.7.0 and `valibot` 1.4.2 resolve inside `@prisma/dev`.
- [x] ESLint 10.8.0 direct flat-config plugins remove the vulnerable legacy minimatch chain; `brace-expansion` resolves only to 5.0.8.
- [x] No `npm audit fix --force`, Prisma downgrade, obsolete Next ESLint preset, or unsafe cross-major transitive override was accepted.

The former Better Auth OIDC/MCP, pre-account-hijacking, Next.js
sharp/libvips, PostCSS, brace-expansion, and Prisma development-tooling
exceptions are closed. Provider-native signup and `/api/auth/**` are also
unavailable publicly. OIDC-provider, MCP, JWT-browser, image-upload, and
user-controlled image-processing features remain outside the approved identity
scope.
