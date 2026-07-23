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
- [x] TanStack Query is pinned exactly to `5.101.4`; its real QueryClient compatibility test passes, and usage is restricted to sanitized session/resend operations with no credential, token, code, or secret in query keys, cached values, or mutation variables. The audit total remains the existing 4 moderate/3 high baseline.
- [x] The repository contains exactly one root package lock.
- [x] Prisma adapter-pg 7.7.0 and PostgreSQL driver 8.16.3 resolve from the root lockfile.
- [x] Vitest is pinned to 4.1.10, resolving the prior critical development-server advisory.
- [x] PostCSS is pinned to 8.5.10; remaining nested findings are recorded by npm audit.
- [x] Current `npm audit` assessment (2026-07-22): 0 critical, 3 accepted high dependency nodes, 4 moderate, 0 low; no Nodemailer, QR, React Email, or TanStack Query finding. Better Auth OIDC/MCP and Next.js transitive sharp/libvips findings are governed by `checklists/npm-security-exception.md`; the enabled identity runtime exposes neither affected feature. No `npm audit fix --force` was run.
- [x] Executable compatibility tests cover SMTP 587/465 modes, malformed username/from/header injection, safe auth/timeout classification, PostgreSQL concurrent claims, deterministic retry/restart/DEAD transitions, terminal non-redelivery, duplicate prevention, and capture/Resend regressions. Full Vitest passed 75/75 and lifecycle Playwright passed 2/2 on 2026-07-21.

## TOTP QR dependency approval

- [x] qrcode is pinned exactly to 1.5.4 and @types/qrcode to 1.5.6 in apps/web/package.json and the sole root package-lock.json.
- [x] Lockfile compatibility retains Node.js 24.18.0, npm 11.16.0, TypeScript 5.9, Next.js 16.2.9, and Better Auth 1.6.11.
- [x] Approval covers the T061–T069 TOTP enrollment increment, including cross-cutting gate T180, behind `totp-qr-code.ts`.
- [x] Audit after resolution: 0 critical, 1 accepted high, 5 moderate, 0 low; no QR-package finding; no force fix was run.
- [x] T180 (2026-07-21): `apps/web/tests/compatibility/qrcode-1.5.4.test.ts` passes 7/7 under Node.js 24.18.0. It asserts exact pins (qrcode 1.5.4, @types/qrcode 1.5.6), server-side import, deterministic local QR generation from a safe test otpauth URI, segment-reconstruction proof that encoded content matches the supplied URI, zero network requests (global fetch/http/https/dns stubbed to throw), a single root package-lock.json, and Next.js 16.2.9 + TypeScript 5.9 coexistence. No client import of qrcode exists. Audit unchanged: 0 critical, 1 accepted high, 5 moderate, 0 low; no QR-package finding; no force fix run.
