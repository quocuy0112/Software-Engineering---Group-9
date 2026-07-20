# ADR: Deferred service-to-service token boundary

## Status

Deferred; documentation only.

## Decision

The Identity feature uses Better Auth's single opaque, PostgreSQL-backed browser session and its sole authentication cookie. The local database baseline is PostgreSQL 16.12 in Docker Compose on `127.0.0.1:55432`, initialized through committed Prisma migrations.

This feature creates no runtime `service-token.ts`, JWT browser session, JWT plugin, service-token route, second authentication cookie, or implementation dependency. No service token is accepted by browser-facing authorization.

A future service-to-service token would require a separate approved ADR defining non-browser principals, exact issuer/audience, narrow scopes, short expiry, key rotation, replay protection, and receiving-service validation. It must not replace or coexist as a second browser-session mechanism.
