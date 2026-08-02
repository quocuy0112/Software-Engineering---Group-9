# Feature 004 Production Provider Gates

This checklist records the fail-closed deployment controls for temporary CV
storage, malware scanning, and optional OpenAI processing. It contains no CV
content, provider tokens, bucket object keys, or consent text.

## Required deployment sequence

1. Run `npm run env:check` with the exact deployment environment. Production
   must use S3 plus workload/role credentials, a customer-managed KMS identity,
   the immutable approved OpenAI model snapshot, explicit privacy approvals,
   and cleanup enabled.
2. Run `npm run cv:scanner:check` inside the worker pod. The check requires the
   reviewed Unix socket metadata, ClamAV 1.4.5, signatures no older than 24
   hours, and no scanner TCP listener.
3. Start the worker and require readiness before traffic. Startup calls the S3
   adapter policy gate and rejects a public policy, incomplete Block Public
   Access, enabled or suspended versioning, non-SSE-KMS encryption, a different
   KMS key, a missing bucket key, expiration beyond 31 days, multipart abort
   beyond one day, or noncurrent-version retention.
4. External dispatch independently rechecks the immutable endpoint/model,
   enable flag, API key, DPA/cross-border/ZDR approval conjunction, and exact
   live consent immediately before every transmission. There is no fallback
   provider.

## Evidence register

| Gate | Automated evidence | Deployment evidence | Status |
| --- | --- | --- | --- |
| Private non-versioned S3, Block Public Access, SSE-KMS/customer key | `s3-retention-policy.test.ts`, storage readiness | Attach sanitized `env:check` and worker-start readiness output | Automated gate passed; live production evidence required before release |
| 31-day maximum expiration, one-day multipart abort, no hidden versions | `s3-retention-policy.test.ts` | Attach sanitized bucket lifecycle review | Automated gate passed; live production evidence required before release |
| ClamAV 1.4.5, fresh signatures, Unix socket only | scanner compatibility tests and `cv:scanner:check` | Attach sanitized in-pod scanner check | Dev/CI gate available; production run required before release |
| Approved OpenAI snapshot and privacy controls | OpenAI compatibility and dispatch-gate tests | Link internal DPA, Vietnamese cross-border assessment, and ZDR approval by identifier only | Automated gate passed; organizational approvals required before enabling production |

No row in this file claims that an unavailable live production control was
observed. Missing deployment or organizational evidence is a release blocker,
not a reason to weaken startup or dispatch checks.
