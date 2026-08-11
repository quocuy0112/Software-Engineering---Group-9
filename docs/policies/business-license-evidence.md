# Business-license evidence policy

**Policy version:** `business-license-evidence-v1`  
**Effective date:** 2026-08-10  
**Scope:** Feature 006 employer-verification evidence only

## Required approvals

Production admission is fail-closed until the deployment record supplies the
three named approvers below and each sets the corresponding approval gate to
`true`. A role label or empty value is not a named approval.

| Function   | Deployment record                    | Approval gate                        |
| ---------- | ------------------------------------ | ------------------------------------ |
| Legal      | `ADMIN_EVIDENCE_LEGAL_APPROVER`      | `ADMIN_EVIDENCE_LEGAL_APPROVED`      |
| Security   | `ADMIN_EVIDENCE_SECURITY_APPROVER`   | `ADMIN_EVIDENCE_SECURITY_APPROVED`   |
| Operations | `ADMIN_EVIDENCE_OPERATIONS_APPROVER` | `ADMIN_EVIDENCE_OPERATIONS_APPROVED` |

## Collection and use

- Accept one PDF, PNG, or JPEG containing 1–5,000,000 bytes for the sole
  purpose of employer verification.
- Keep source bytes isolated until malware, detected-type, structural-integrity,
  and preview-safety checks all pass.
- Do not use evidence for analytics, model training, automated approval, or
  automated enforcement.

## Access

- The applicant may access evidence only while the request is non-terminal.
- A Platform Administrator may access qualified evidence only with current
  authority, the designated administrator session, and two-factor proof no
  more than 15 minutes old.
- Preview and download return authenticated bytes. Public or durable browser
  URLs, telemetry, ordinary logs, and public buckets are prohibited.
- Review decisions remain disabled whenever qualified evidence cannot be
  opened continuously.

## Lifecycle and deletion

- Superseded evidence and evidence for REJECTED, CANCELLED, or EXPIRED requests
  becomes inaccessible immediately and is physically deleted within 24 hours.
- Evidence for an APPROVED request remains accessible only while its associated
  company verification is active. Once superseded or inactive it becomes
  inaccessible immediately and is deleted within 30 calendar days.
- PENDING_CHECKS produces one delayed notice at 15 minutes and expires at 24
  hours. A continuous protected-viewer outage escalates at 15 minutes, produces
  one applicant notice at 24 hours, and expires the request at 72 hours.
- Reconciliation records identifiers and deletion outcomes only; it must not
  copy evidence bytes or storage locators into ordinary logs or audit context.

## Storage and operational controls

- Production uses a private S3 bucket, workload identity, a customer-managed
  KMS key, and the `business-evidence/` object prefix. Static AWS credentials in
  application environment variables are prohibited.
- Local development may use an absolute, non-public filesystem directory with
  AES-256-GCM ciphertext and a purpose-specific 32-byte key.
- The malware scanner is available only through the fixed private socket
  `/run/clamav/clamd.sock`.
- The evidence worker exposes independent readiness for safety processing,
  lifecycle deadlines, retention, snapshots, and security notifications.

## Exceptions and review

This policy cannot extend the deadlines or viewers fixed by FR-026 through
FR-028. Any exception requires a new policy version, all three named approvals,
and a verified deployment gate before evidence admission resumes.
