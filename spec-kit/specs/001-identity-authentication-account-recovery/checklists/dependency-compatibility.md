# Dependency compatibility baseline

- [x] Node.js is pinned to 24.18.0 and npm to 11.16.0.
- [x] Next.js is pinned to 16.2.11.
- [x] Better Auth and its Prisma adapter are pinned to 1.6.25; core 1.6.25, utils 0.4.2, and better-call 1.3.7 resolve once.
- [x] Prisma CLI and client remain pinned to 7.9.0; only its development transitives are overridden to patched `find-my-way` 9.7.0 and `valibot` 1.4.2.
- [x] Resend is pinned to 6.17.2 and remains optional locally.
- [x] Nodemailer is pinned exactly to 9.0.3 and @types/nodemailer to 8.0.1 in the sole root lockfile.
- [x] `npm ls nodemailer @types/nodemailer next --workspace @smarthire/web --depth=0` resolves Nodemailer 9.0.3, @types/nodemailer 8.0.1, and Next.js 16.2.11 under Node.js 24.18.0/npm 11.16.0.
- [x] Nodemailer is approved only for server-side SMTP adapter use behind EmailService; capture remains the generated default and Resend remains production-oriented.
- [x] React Email components are pinned exactly and resolve from the root lockfile.
- [x] TanStack Query is pinned exactly to `5.101.4`; its real QueryClient compatibility test passes, and usage is restricted to sanitized session/resend operations with no credential, token, code, or secret in query keys, cached values, or mutation variables.
- [x] The repository contains exactly one root package lock.
- [x] Prisma adapter-pg 7.9.0 and PostgreSQL driver 8.16.3 resolve from the root lockfile.
- [x] Vitest is pinned to 4.1.10, resolving the prior critical development-server advisory.
- [x] PostCSS is pinned to 8.5.22 and root-overridden for the Next.js chain; sharp is root-overridden to 0.35.3.
- [x] Current `npm audit --json` assessment (2026-07-27): 0 critical, 0 high, 0 moderate, 0 low. Better Auth 1.6.25, `find-my-way` 9.7.0, `valibot` 1.4.2, and `brace-expansion` 5.0.8 remove the new findings while Next.js 16.2.11, Prisma 7.9.0, PostCSS 8.5.22, and sharp 0.35.3 remain pinned. No `npm audit fix --force` was run.
- [x] ESLint resolves exactly 10.8.0 with `@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`, and `eslint-plugin-react-hooks`; obsolete `eslint-config-next`/`@eslint/eslintrc` chains are absent.
- [x] Historical (superseded) executable compatibility evidence covered SMTP 587/465 modes, malformed username/from/header injection, safe auth/timeout classification, PostgreSQL concurrent claims, deterministic retry/restart/DEAD transitions, terminal non-redelivery, duplicate prevention, and capture/Resend regressions. The recorded Vitest 75/75 and lifecycle Playwright 2/2 results from 2026-07-21 are not current PASS claims.

## TOTP QR dependency approval

- [x] qrcode is pinned exactly to 1.5.4 and @types/qrcode to 1.5.6 in apps/web/package.json and the sole root package-lock.json.
- [x] Lockfile compatibility retains Node.js 24.18.0, npm 11.16.0, TypeScript 5.9, Next.js 16.2.11, and Better Auth 1.6.25.
- [x] Approval covers the T061–T069 TOTP enrollment increment, including cross-cutting gate T180, behind `totp-qr-code.ts`.
- [x] Audit after dependency repair: 0 critical, 0 high, 0 moderate, 0 low; no QR-package finding; no force fix was run.
- [x] T180 revalidated on 2026-07-24: `apps/web/tests/compatibility/qrcode-1.5.4.test.ts` passes 7/7 under Node.js 24.18.0. It asserts exact pins (qrcode 1.5.4, @types/qrcode 1.5.6), server-side import, deterministic local QR generation from a safe test otpauth URI, segment-reconstruction proof that encoded content matches the supplied URI, zero network requests (global fetch/http/https/dns stubbed to throw), a single root package-lock.json, and Next.js 16.2.11 + TypeScript 5.9 coexistence. No client import of qrcode exists.
