# Implementation Plan: Company Member Management

**Branch**: `024-company-member-management` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

## Summary

Add an Owner-only Team page where the sole company owner can invite existing accounts as HR Manager or Recruiter, revoke pending invitations, change managed roles, suspend, restore, and remove members. All commands are company-scoped, CSRF-protected, idempotent, audited, and immediately enforce membership state.

## Technical Context

**Language**: TypeScript, Next.js App Router, Prisma/PostgreSQL, Zod, Vitest, Testing Library.  
**Existing reuse**: Better Auth session/account boundary, `CompanyMembership`, membership history, audit writer, in-app/email outbox, recruiter company-settings route and UI.  
**New storage**: `CompanyInvitation` with an opaque, hashed one-time token; no plaintext token persistence.  
**Scope**: Owner membership management only; no Owner transfer, billing, job assignment, or recruitment capability changes.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Security and tenant isolation | PASS | Every owner command resolves one active verified company and owner membership server-side; invitation acceptance binds recipient email. |
| State and audit integrity | PASS | Transactions use compare-and-set/idempotency, preserve membership history, audit commands, and protect the last active Owner. |
| Privacy | PASS | List projections expose only safe member identity; invitation token is hashed and never returned after delivery. |
| Accessibility | PASS | Team controls have labels, confirmations, keyboard flow, and non-colour status/error feedback. |

## Design

1. Add invitation and team-activity storage. An invitation is `PENDING`, `REVOKED`, `ACCEPTED`, `DECLINED`, or `EXPIRED`, holds company/email/allowed role, expiry, invitor, token digest, and version; activity rows provide immutable Owner-visible evidence for invitation and membership commands.
2. `CompanyTeamService` centralizes owner authorization and all invitation/membership commands in transactions. It refuses target Owners, duplicate eligible invitations/memberships, and cross-company access.
3. Owner routes list team and activity, create/revoke invitations, and update membership lifecycle/role. Recipient preview, acceptance, and decline routes consume the token only for the matching signed-in account.
4. Reuse existing immutable membership history/audit and notification boundaries. Queue a recipient-bound email containing the encrypted one-time acceptance token and create a token-free in-app invitation notification in the same transaction; acceptance or decline creates Owner email/in-app delivery in that same transaction; never return the token to the Owner browser.
5. Add `/recruiter/company-settings/team` and a Team section in company settings. It is rendered management-capable only when server projection says the user is Owner.

## Project Structure

```text
web/
├── prisma/schema.prisma and migration
├── src/app/api/recruiter/company/team/
│   ├── route.ts
│   ├── invitations/route.ts
│   ├── invitations/[invitationId]/revoke/route.ts
│   ├── memberships/[membershipId]/route.ts
│   └── invitations/accept/route.ts
├── src/backend/company-members/
│   ├── company-team-service.ts
│   └── company-team-authorization.ts
├── src/shared/contracts/company-members/team.ts
├── src/frontend/features/recruiter-workspace/company-team-screen.tsx
└── tests/{backend,frontend,security}/company-members/
```

## Synchronization Impact

- Feature 006/009 company membership vocabulary remains valid; Feature 024 adds the owner-facing invitation path.
- Feature 021 must continue to derive active roles from `CompanyMembership`; it is not changed by invitation lifecycle.
- Existing `HIRING_MANAGER` data remains readable for compatibility but is excluded from Owner role controls.
