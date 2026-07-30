# Transactional email operations

SmartHire sends every transactional message through `EmailOutbox -> due-outbox processor -> EmailService -> capture | smtp | resend`. Registration, verification resend, and recovery commit their identity state and outbox row before returning. Provider availability must never roll back those transactions.

## Local operation

`EMAIL_ADAPTER=capture` is the generated default. Run `npm run dev` to supervise Next.js and the worker together, or run `npm run dev:web` and `npm run email:worker` in separate terminals for diagnosis. Captures are written beneath the configured, gitignored `EMAIL_CAPTURE_DIR`. Never commit captures because their message bodies may contain verification or recovery links.

SMTP is an explicit local/team demonstration option only. Store its credentials in untracked `web/.env.local`; never print them or persist them in outbox/audit records. Gmail port 587 uses STARTTLS with `SMTP_SECURE=false` and `SMTP_USE_TLS=true`; port 465 uses implicit TLS with `SMTP_SECURE=true`.

## Resend production readiness

Before selecting `EMAIL_ADAPTER=resend`:

1. Verify the sending domain in Resend and publish the provider-issued DKIM records.
2. Publish an SPF record that includes only approved senders. Merge with an existing SPF policy instead of creating multiple SPF TXT records.
3. Publish DMARC initially in monitored mode with an approved aggregate-report mailbox, review alignment reports, then raise enforcement to quarantine or reject under the organization's change process.
4. Use a role mailbox in `EMAIL_FROM`, confirm From-domain alignment, and send verification, reset, and notification test messages to controlled recipients.
5. Store `RESEND_API_KEY` only in the deployment secret manager and scope it to the intended application/domain where the provider supports that boundary.

DNS values are provider- and domain-specific; copy them from the active Resend domain screen during the approved deployment rather than from this repository.

## Key rotation

Create a replacement provider key, add it to the deployment secret manager, restart the worker fleet, and prove delivery with a controlled message before revoking the old key. Do not place either value in tickets, command history, screenshots, logs, database rows, or audit context. Roll back by restoring the previous secret only while it remains valid; otherwise select capture in a non-production recovery environment while provider access is repaired.

## Monitoring and alerting

Monitor only safe metadata: counts and age of `PENDING`, due `RETRYABLE`, expired `PROCESSING`, `DEAD`, and recent `SENT` rows; attempts; lease expiry; next-attempt time; adapter name; and allowlisted error code. Never export message payloads, token-bearing URLs, recipient addresses, provider raw errors, or credentials to metrics.

Alert when the oldest due row exceeds the delivery objective, retry/dead counts rise above the normal baseline, leases repeatedly expire, the worker exits or stops polling, or terminal-failure audit creation fails. A provider outage should grow the retryable backlog without changing committed account state.

## Recovery

- `PENDING` and due `RETRYABLE` rows are picked up when the worker resumes.
- Expired `PROCESSING` leases are reclaimable; do not manually clear an active lease.
- `SENT` and `DEAD` are terminal and must not be edited or re-delivered.
- For a `DEAD` row, fix the allowlisted operational cause and create an explicitly reviewed replacement request if business policy permits it.
- On SIGINT/SIGTERM, allow the worker to stop polling and drain in-flight work. If it was killed, wait for lease expiry before concluding that a row is stranded.
