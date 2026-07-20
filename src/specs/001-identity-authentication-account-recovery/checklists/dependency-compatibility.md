# Dependency compatibility baseline

- [x] Node.js is pinned to 24.18.0 and npm to 11.16.0.
- [x] Next.js is pinned to 16.2.9.
- [x] Better Auth and its Prisma adapter are pinned to 1.6.11.
- [x] Prisma CLI and client are pinned to 7.7.0 without creating a schema or migration.
- [x] Resend is pinned to 6.17.2 and remains optional locally.
- [x] Nodemailer is pinned exactly to 9.0.3 and @types/nodemailer to 8.0.1 in the sole root lockfile.
- [x] `npm ls nodemailer @types/nodemailer next --workspace @smarthire/web --depth=0` resolves Nodemailer 9.0.3, @types/nodemailer 8.0.1, and Next.js 16.2.9 under Node.js 24.18.0/npm 11.16.0.
- [x] Nodemailer is approved only for server-side SMTP adapter use behind EmailService; capture remains the generated default and Resend remains production-oriented.
- [x] React Email components are pinned exactly and resolve from the root lockfile.
- [x] The repository contains exactly one root package lock.
- [x] Prisma adapter-pg 7.7.0 and PostgreSQL driver 8.16.3 resolve from the root lockfile.
- [x] Vitest is pinned to 4.1.10, resolving the prior critical development-server advisory.
- [x] PostCSS is pinned to 8.5.10; remaining nested findings are recorded by npm audit.
- [x] Current `npm audit --json` assessment (2026-07-20): 0 critical, 1 high, 5 moderate, 0 low; no Nodemailer finding. The Better Auth high finding remains governed by `checklists/npm-security-exception.md`; moderate findings affect Next/PostCSS and Prisma development tooling. No `npm audit fix --force` was run.
- [ ] Before implementation acceptance, executable compatibility tests must cover SMTP 587/465 modes, malformed username/from/header injection, safe auth/timeout classification, concurrent claims, retry/restart/DEAD transitions, duplicate prevention, and capture/Resend regressions.
