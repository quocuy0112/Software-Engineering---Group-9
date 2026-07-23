# Temporary npm security exceptions

- [x] npm audit was rerun on 2026-07-22 without `--force`.
- [x] Current result: 0 critical, 3 high, 4 moderate, 0 low.
- [x] No advisory is reported for Nodemailer, qrcode, React Email, TanStack Query, or the SMTP/capture/Resend adapters.
- [x] No automatic downgrade or `npm audit fix --force` is approved.

## Better Auth OIDC/MCP redirect advisory

- [x] Better Auth remains pinned to 1.6.11 for the approved schema/session/TOTP compatibility baseline.
- [x] GHSA-86j7-9j95-vpqj affects `javascript:` redirect handling in Better Auth OIDC-provider and MCP functionality.
- [x] SmartHire configures only email/password credentials and the approved TOTP plugin.
- [x] Runtime scans find no OIDC-provider, MCP, or JWT-plugin import, configuration, route, or exposure.
- [x] The 1.6.13+ fix requires a deliberate Better Auth pin/schema/compatibility rebaseline; it must not be applied as an unreviewed lockfile change.

The accepted high finding is outside the enabled runtime surface. Reevaluate it before release, any Better Auth pin change, or enabling OIDC/MCP functionality.

## Next.js transitive sharp/libvips advisory

- [x] `npm audit` reports GHSA-f88m-g3jw-g9cj against sharp below 0.35.0 and consequently reports both `sharp` and direct package `next` as high.
- [x] Next.js 16.2.9 declares `sharp ^0.34.5`; the fixed sharp major is outside that supported range.
- [x] Repository scans find no `next/image`, `<Image>`, direct sharp import, external image optimizer route, or user-controlled image-processing feature.
- [x] The TOTP QR is generated locally and rendered as a base64 data URI; it is not passed to Next image optimization.
- [x] npm's suggested Next.js 9.3.3 downgrade violates the approved Next.js 16.2.9 baseline and is not an acceptable security fix.

This exception is limited to the current identity-only application with no image-processing surface. It expires if image upload/optimization is added, Next.js expands sharp usage, or a compatible patched Next.js/sharp chain becomes available. At that point, upgrade and rerun build, E2E, performance, and compatibility gates.

## Moderate findings

The four moderate nodes are PostCSS in the Next.js dependency chain and Prisma development tooling through `@prisma/dev`/`@hono/node-server`. They remain tracked; no application request handler imports Prisma development tooling. Reevaluate all findings before production deployment.
