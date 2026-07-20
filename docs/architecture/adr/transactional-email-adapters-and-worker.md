# ADR: Transactional email adapters and due-outbox worker

## Status

Accepted for the Identity, Authentication, and Account Recovery feature.

## Context

Identity workflows must queue transactional email without coupling successful registration, verification resend, recovery, or security-notification requests to an external provider. The project needs deterministic local capture, optional real-mail demonstrations, and a production-oriented provider while preserving one replaceable boundary and durable retry behavior.

## Decision

The only topology is:

`EmailOutbox -> due-outbox processor -> EmailService -> capture | SMTP | Resend`

- `capture` is the generated default local adapter.
- `smtp` is opt-in for local development and team demonstrations.
- `resend` is production-oriented; production deployment remains outside this academic project.
- `EMAIL_ADAPTER` is the sole selector. `EMAIL_DRIVER` is removed.
- Nodemailer `9.0.3` with `@types/nodemailer` `8.0.1` is exactly pinned in the root lockfile and may be imported only by server-side SMTP adapter code. Compatibility is based on Node.js `24.18.0`, TypeScript 5.9, and Next.js `16.2.9`.

Originating services transactionally create EmailOutbox rows and return without calling an adapter. A long-running `npm run email:worker` process polls due `PENDING` and `RETRYABLE` rows. It claims bounded batches using PostgreSQL `FOR UPDATE SKIP LOCKED` plus recoverable owner/expiry leases, commits claims before network I/O, and conditionally finalizes only its own claims.

Attempts use bounded exponential backoff with jitter. Temporary provider/connection/timeout errors become `RETRYABLE`; permanent authentication, configuration, policy, or recipient rejection and exhausted attempts become `DEAD`; success becomes `SENT`. Attempts increment exactly once, safe error codes replace raw errors, and terminal failure emits one idempotent secret-free audit event. Expired leases recover after worker interruption.

Gmail port 587 requires STARTTLS, `SMTP_SECURE=false`, and required TLS. Optional port 465 requires implicit TLS and `SMTP_SECURE=true`. Usernames and sender mailboxes require complete addresses; sender input rejects CR, LF, and control characters. Google App Passwords are supported. SMTP/provider credentials never enter source, logs, client bundles, database rows, job payloads, or audit data.

Normal local `npm run dev` should supervise both web and worker processes with clean signal forwarding. Separate `npm run dev:web` and `npm run email:worker` remain available.

## Consequences

Provider latency and failure do not determine request success. Capture and network adapters share identical lifecycle semantics. PostgreSQL becomes authoritative for claim/retry state, and operational deployment must run at least one worker. At-least-once recovery is combined with durable logical idempotency, claim ownership, and provider idempotency where available to prevent duplicate logical delivery.

The worker, supervisor commands, claim SQL, retry policy, removal of `EMAIL_DRIVER`, and compatibility tests require implementation tasks before this decision is complete. No task is marked complete by this ADR.

## Security and dependency assessment

The 2026-07-20 npm audit reports 0 critical, 1 high, and 5 moderate findings, with no Nodemailer finding. Better Auth's high OIDC/MCP advisory remains under the existing scoped exception because those capabilities are not configured or exposed. No forced audit fix or dependency downgrade is approved; any pin change requires renewed compatibility evidence.

## Alternatives rejected

- Direct Nodemailer or Resend calls from Route Handlers/services: violates provider independence and blocks responses on external I/O.
- In-process fire-and-forget after a response: loses work on process termination.
- Separate `EMAIL_DRIVER` and `EMAIL_ADAPTER` selectors: permits contradictory configuration.
- Claims without row locking or recoverable leases: permit duplicate processing or stranded jobs.
