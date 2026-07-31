# Profile and account security operations

This runbook covers Feature 002 security operations for candidate profile and
self-service account changes. It supplements
`authentication-security.md` and `transactional-email.md`.

Never copy profile request bodies, names, email addresses, passwords,
verification proofs, full verification URLs, cookies, session or CSRF values,
forwarding headers, raw IP addresses, recipient ciphertext, protected payloads,
provider responses, database errors, or stack traces into logs, metrics,
tickets, chat, or audit context. Use only authorized record identifiers,
correlation identifiers, allowlisted actions/results, timestamps, counts, and
safe error codes.

## Trusted proxy configuration

`AUDIT_TRUSTED_PROXY_HOPS` is the exact number of trusted reverse-proxy hops
between the public client and the application process. It is not a general
"trust proxy" switch.

| Deployment path                                               | Value |
| ------------------------------------------------------------- | ----: |
| Controlled local/test client -> application                   |   `0` |
| Client -> trusted load balancer -> application                |   `1` |
| Client -> trusted CDN -> trusted load balancer -> application |   `2` |

The application validates the direct peer and every comma-separated
`X-Forwarded-For` entry, appends the direct peer to that chain, and selects the
address immediately before the configured trusted hops. A value of `0` ignores
forwarded entries and uses only the direct peer. The accepted configuration
range is 0 through 10, the forwarded chain is limited to 20 entries, and
production requires at least one trusted hop.

Before deployment:

1. Draw the real ingress path for every production entry point, including
   failover paths, and count only infrastructure controlled by SmartHire or its
   approved hosting provider.
2. Configure the outermost trusted edge to replace or sanitize untrusted
   forwarding headers. Do not allow a client to prepend a value that the
   application could select.
3. Set the same hop count on every application instance.
4. Run `npm run env:check` with the deployment environment. This validates the
   hop count without printing network evidence or secrets.
5. Send controlled IPv4 and IPv6 requests through each ingress path and confirm
   that accepted security mutations contain an `ipPrefixDigest`, never a raw
   address or forwarding header.
6. Test a missing peer, malformed address, overlong chain, and shorter-than-
   configured chain. Sensitive mutations must fail closed with a safe response.

The selected address is reduced to an IPv4 `/24` or IPv6 `/56`, then protected
with a purpose-separated HMAC derived from `TOKEN_SECRET`. Only the digest is
stored in audit evidence. A topology change is therefore a security
configuration change: update and revalidate the hop count before routing
traffic through the new path.

## Email-change proof and recipient lifecycle

An email-change request requires the authenticated account, its authoritative
session, recent current-password proof, a unique idempotency key, a valid
network-source digest, and an available normalized email claim. The transaction
then:

1. supersedes an older pending request;
2. stores only the one-time proof digest on `EmailChangeRequest`;
3. queues a verification message with a protected snapshot of the proposed
   address and a sealed proof;
4. queues a security alert with a separately protected snapshot of the current
   effective address; and
5. appends the allowlisted accepted audit event.

The proof has 32 random bytes and expires after 30 minutes. The delivery worker
unseals it only while rendering the verification message and places it after
`#proof=` in `/verify-email-change`. URL fragments are not sent in the HTTP
request. The verification page removes the fragment from the address bar and a
GET navigation never changes identity state. Verification digests, proofs, and
full URLs must not be copied into telemetry or support records.

Recipient snapshots use AES-256-GCM with separate versioned purposes:

- `email-change-verification.v1` for the proposed address;
- `email-change-old-address.v1` for the current-address alert; and
- `password-change-notice.v1` for the effective address at password-change
  finalization.

The worker unseals a recipient immediately before the provider call. Operators
must not decrypt snapshots for diagnosis. Diagnose delivery by outbox kind,
status, attempts, timestamps, and `safeErrorCode`; confirm the destination only
through an authorized user-driven re-request.

If a proof is reported exposed, treat it as a credential:

1. do not request or preserve the proof value;
2. contain access to the affected account and revoke suspicious sessions;
3. supersede the pending change through a new authorized request or allow it to
   expire;
4. inspect allowlisted request/verification audit events by correlation and
   target identifiers; and
5. confirm that the old effective email remains authoritative unless a valid
   verification transaction completed.

## Password-change operation recovery

A password change is a durable, fail-closed operation. Its milestones are
`INTENT_RECORDED`, `PASSWORD_UPDATED`, `OTHER_SESSIONS_REVOKED`, and
`FINALIZED`. A recoverable failure is recorded as `FAILED_RETRYABLE` with an
allowlisted `failureCode` and `retryAt`; it is not reported as success.

The only supported retry is an authenticated resubmission from the same
initiating session with the same idempotency key and byte-equivalent password
submission. The service re-proves the session, detects which milestones already
hold, and converges without duplicating the notification or final audit event.

Do not:

- create a replacement idempotency key for the same partial operation;
- ask a user to disclose either password;
- edit an operation status, timestamp, digest, outbox link, or audit link;
- directly edit the Better Auth credential hash or session rows; or
- claim completion while another session is usable.

An authorized database operator may use aggregate, read-only diagnostics such
as:

```sql
SELECT
  "status",
  "failureCode",
  COUNT(*) AS "operationCount",
  MIN("retryAt") AS "oldestRetryAt",
  MIN("updatedAt") AS "oldestUpdatedAt"
FROM "PasswordChangeOperation"
WHERE "status" <> 'FINALIZED'
GROUP BY "status", "failureCode"
ORDER BY "status", "failureCode";
```

```sql
SELECT
  "failureCode",
  COUNT(*) AS "dueCount",
  MIN("retryAt") AS "oldestDueAt"
FROM "PasswordChangeOperation"
WHERE "status" = 'FAILED_RETRYABLE'
  AND "retryAt" <= CURRENT_TIMESTAMP
GROUP BY "failureCode"
ORDER BY "failureCode";
```

Do not select `submissionBindingDigest`, credential data, session tokens, or
notification payloads for routine monitoring. Alert on a new or growing
`FAILED_RETRYABLE` population, repeated failure codes, or operations remaining
between security milestones beyond the normal request window. Set paging
thresholds from the production baseline; these queries do not authorize an
automatic database replay.

When the initiating session is no longer authoritative, the operation cannot
be resumed from another session. Preserve the safe operation evidence, contain
any credential/session ambiguity, and escalate to the account-security owner.
Use the existing supported recovery flow if the user can no longer
authenticate; never bypass the session binding.

## Outbox monitoring and failure recovery

Run the worker with `npm run email:worker`. It polls once per second when idle,
claims up to 10 due rows with `FOR UPDATE SKIP LOCKED`, and uses a 60-second
lease. An expired `PROCESSING` lease is reclaimable. Retry delay starts at
approximately 30 seconds, doubles to a one-hour cap, and includes 10% jitter.
A non-retryable provider result or the fifth failed claimed attempt moves the
row to `DEAD` and creates one `email.delivery_failed` audit event.

Safe aggregate diagnostics:

```sql
SELECT
  "status",
  "kind",
  "safeErrorCode",
  COUNT(*) AS "messageCount",
  MIN("nextAttemptAt") AS "oldestNextAttemptAt",
  MIN("createdAt") AS "oldestCreatedAt"
FROM "EmailOutbox"
GROUP BY "status", "kind", "safeErrorCode"
ORDER BY "status", "kind", "safeErrorCode";
```

```sql
SELECT
  COUNT(*) AS "expiredLeaseCount",
  MIN("leaseExpiresAt") AS "oldestExpiredLease"
FROM "EmailOutbox"
WHERE "status" = 'PROCESSING'
  AND "leaseExpiresAt" <= CURRENT_TIMESTAMP;
```

Recovery rules:

- Restarting the worker is sufficient for due `PENDING`, `RETRYABLE`, and
  expired `PROCESSING` rows.
- Do not clear a live lease or run multiple direct-delivery attempts.
- `SENT` and `DEAD` are terminal. Do not change their status, attempts,
  protected recipient, payload, template, kind, or idempotency key.
- For `DEAD`, repair the provider/configuration cause, preserve the original
  row, and use a separately reviewed, user-authorized replacement request when
  policy permits. There is no general-purpose database requeue command.
- A provider outage must not roll back an accepted email request, verified
  identity, password change, or preference update.

## `TOKEN_SECRET` rotation

Feature 002 derives independent versioned keys from `TOKEN_SECRET` for email
proof digests/sealing, recipient snapshots, password submission binding, and
network-source digests. The current implementation has no multi-key decrypt or
digest transition.

For a planned rotation, stop new sensitive mutations, finish or disposition
retryable password operations, drain deliverable protected outbox rows, and
expire/reissue pending email changes before changing the secret on every
instance. Verify new requests, worker delivery, audit digests, and session
continuity after restart. Rotating first will make existing sealed values
undecryptable and existing digests unverifiable.

For suspected compromise, prioritize containment over preserving outstanding
proofs: rotate under the incident process, invalidate or supersede affected
pending actions, revoke affected sessions, and reissue only through supported
user flows. Never retain the compromised secret in an application fallback.

## Privacy-safe incident handoff

An incident handoff may contain:

- environment, UTC time range, operator, and incident identifier;
- aggregate counts by operation/outbox status and allowlisted failure code;
- approved operation, outbox, audit target, and correlation identifiers; and
- containment and verification steps performed.

Escalate proxy-chain uncertainty to platform security, credential/session
ambiguity to account security, provider/backlog issues to messaging
operations, and suspected personal-data disclosure to the privacy/security
incident owner. Database access remains least privilege and all evidence
handling follows SmartHire's existing retention and deletion policy.
