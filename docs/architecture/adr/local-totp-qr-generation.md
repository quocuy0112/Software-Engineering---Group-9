# ADR: Local TOTP enrollment QR generation

Status: Approved
Scope: Approved for the T061–T069 TOTP enrollment increment, including the cross-cutting dependency and compatibility gate T180. T070 and later may consume an enrollment result but may not generate a new QR without later approval.

Only `apps/web/src/server/auth/identity/totp-qr-code.ts` may import exact `qrcode` 1.5.4. Its minimal typed server-only interface accepts only the Better Auth-generated `otpauth` URI and safe rendering options, rejects malformed or unexpected input, generates locally without network access, never calls an external QR service, and never persists or logs the URI, secret, rendered QR, or backup codes. Better Auth remains exclusive secret owner; manual-key fallback and no-store responses remain mandatory.

T180 directly blocks T065 and is limited to pre-implementation evidence: exact pins and sole-root-lockfile resolution; Node.js 24.18.0, Next.js 16.2.9, and TypeScript compatibility; actual-library QR generation; decoding or equivalent proof that output matches the supplied test `otpauth` URI; zero network requests; server-only compatibility; absence of browser/client imports; and npm audit assessment.

Malformed URI/protocol/required-field rejection, rendering-option validation, bounded output, redaction, no persistence, and manual-key behavior are SmartHire utility responsibilities implemented by T065 and tested after implementation by T069.