# Notification Delivery Requirements Checklist

**Purpose**: Verify Feature 016 channel coverage, privacy, and operational completeness before implementation completion
**Created**: 2026-08-14
**Feature**: [spec.md](../spec.md)

## Channel Policy

- [ ] Every current completed-event email variant maps to an allow-listed in-app event.
- [ ] Existing email recipients, subject, body, preference, queue, retry, and provider behavior are unchanged.
- [ ] Verification, reset, recovery-proof, and one-time-code emails are excluded from in-app mirroring.
- [ ] Application receipt, company application receipt, message, and report receipt are in-app only.
- [ ] No new email kind or template is introduced without an explicit critical-gap requirement.

## Privacy and Authorization

- [ ] Notification persistence contains no token, proof, secret, arbitrary HTML, private evidence, unrestricted admin note, or raw email body.
- [ ] All list, count, read, read-all, and context-read operations are scoped by authenticated recipient on the server.
- [ ] Missing and foreign notification identifiers are indistinguishable to unauthorized callers.
- [ ] Company-scoped recipients are resolved from active authorized memberships and duplicate user identities are collapsed.
- [ ] Internal destinations are allow-listed and re-authorized when opened.

## Integrity and Reliability

- [ ] Unique recipient/event identity prevents duplicates across request, transaction, migration, and worker retries.
- [ ] PostgreSQL is authoritative for inbox and read state.
- [ ] Email provider failure does not hide a committed in-app record.
- [ ] Notification failures do not corrupt authoritative workflow state.
- [ ] Legacy connection read state and pending recruitment work are preserved through additive migration.
- [ ] Expired visible records are removed after 90 days without deleting originating audits or workflows.

## Experience and Quality

- [ ] Candidate, recruiter, and administrator shells expose the unified center.
- [ ] Loading, empty, error, retry, read, unread, overflow, and pagination states are covered.
- [ ] Context clearing occurs only after protected content displays successfully.
- [ ] Keyboard, focus, live status, contrast, responsive layout, and non-color status requirements pass.
- [ ] Notification availability and multi-session convergence meet P95 at or below five seconds.
- [ ] All Critical, High, Medium, and Low Spec Kit and project validation findings are resolved.
