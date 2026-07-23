# Resolved npm security exceptions

- [x] `npm audit --json` was rerun on 2026-07-24 without `--force`.
- [x] Current result: 0 critical, 0 high, 0 moderate, 0 low.
- [x] Better Auth and its Prisma adapter use the minimum fixed 1.6.13 patch.
- [x] The 1.6.13 PostgreSQL compatibility suite passes without a schema or migration change.
- [x] Next.js 16.2.11, PostCSS 8.5.22, and sharp 0.35.3 remove the prior Next.js dependency-chain findings.
- [x] Prisma CLI/client/adapter-pg 7.9.0 removes the prior development-tooling findings.
- [x] No `npm audit fix --force` or major framework downgrade was run.

The former Better Auth OIDC/MCP, Next.js sharp/libvips, PostCSS, and Prisma
development-tooling exceptions are closed. OIDC-provider, MCP, JWT-browser,
image-upload, and user-controlled image-processing features remain outside the
approved identity scope.
