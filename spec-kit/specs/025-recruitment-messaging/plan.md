# Implementation Plan: Application-Scoped Recruitment Messaging

**Branch**: `025-recruitment-messaging` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

## Summary

Add a dedicated recruitment-thread aggregate keyed by `JobApplication`, with one Candidate-facing thread, eligible HR/Recruiter assignment, company/job-aware recruiter inboxes, and audited Owner read-only oversight. Reuse existing messaging transport, validation, reports, notifications, and session boundaries while keeping recruitment authorization separate from professional-connection chats.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Next.js App Router, Prisma 7, PostgreSQL.  
**Primary Dependencies**: Existing messaging services/repositories, Better Auth session boundary, Zod, Socket.IO, Vitest.  
**Storage**: PostgreSQL additive migration with legacy read fallback.  
**Testing**: Vitest unit/contract/integration/security/accessibility plus focused Playwright.  
**Target Platform**: Existing Candidate/recruiter workspace and same-process realtime server.  
**Project Type**: Full-stack web application.  
**Performance Goals**: P95 list/detail ≤2 seconds for 100 threads with 20 messages each.  
**Constraints**: Server-side membership/assignment authorization; no new browser credentials; Owner views are state-neutral; critical writes transactional/idempotent.  
**Scale/Scope**: One thread per application; Candidate, assigned HR/Recruiter, and Owner read-only. No group chat, attachments, unrestricted account search, export, or general Administrator inbox.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Security and tenant isolation | PASS | Company, assignment, application stage, and account state are resolved server-side for every request/event. |
| State and audit integrity | PASS | Unique thread, idempotent message, reassignment, closure, and Owner-view audit are required. |
| Privacy and least privilege | PASS | Owner is a separate read-only projection and never a participant. |
| Accessibility and quality | PASS | Candidate responsive UI, recruiter desktop filters, state feedback, and keyboard checks are required. |
| Architecture boundaries | PASS | Route handlers call services/repositories; the existing realtime transport delegates to a recruitment authorization adapter. |

## Architecture

```text
Candidate application / Recruiter Messages / Owner oversight
  -> typed recruitment messaging client
  -> Next.js route handler + session/CSRF boundary
  -> RecruitmentThreadService + authorization policy
  -> Prisma recruitment repository + application/membership data
  -> RecruitmentThread / RecruitmentMessage
  -> existing realtime publisher and notification boundary

Messaging report -> existing protected report workflow through a recruitment evidence adapter
```

## Design Decisions

1. `RecruitmentThread` is unique on `applicationId`, denormalizes company/job/candidate scope, carries current staff assignment, lifecycle/version, message sequence, and separate Candidate/staff read boundaries. `RecruitmentMessage` records author membership and sender-scoped idempotency.
2. Active canonical stages (`APPLIED`, `VIEWED`, `SHORTLISTED`, `INTERVIEWING`, `OFFERED`) are writable; terminal stages project read-only history.
3. Opening an individual candidate detail records the one-time automatic `APPLIED` to `VIEWED` transition; a separate `Message candidate` command atomically creates and self-assigns the unique thread for the first active HR Manager or Recruiter. Candidate sending requires that assignee; only the current assignee sends, while another HR Manager may read and explicitly reassign or take over. Reassignment preserves history and revokes former-assignee write authority.
4. Owner access derives from active `OWNER` membership in the selected company, writes a minimal audit event, and never touches read, presence, typing, notification, or participant APIs.
5. Recruiter filters are applied server-side for authorized company/job/stage/assignment context. A company ID from the browser never grants scope.
6. Feature 019 receives an application-thread deep-link rule; participant notifications target only Candidate/current assignee.
7. Feature 013 receives recruitment evidence via an adapter; no unrestricted administrator message browser is added.

## Project Structure

```text
web/
├── prisma/schema.prisma and migrations/
├── src/backend/recruitment-messaging/{recruitment-thread-authorization,recruitment-thread-service,recruitment-thread-notifications}.ts
├── src/backend/repositories/recruitment-messaging/prisma-recruitment-thread-repository.ts
├── src/app/api/{recruiter/messages,applications/[applicationId]/recruitment-thread,recruitment-threads/[threadId]/messages}/
├── src/shared/contracts/recruitment-messaging/
├── src/frontend/features/recruitment-messaging/{components,client}/
└── tests/{backend,frontend,security,system}/recruitment-messaging/
```

## Synchronization Impact

- Feature 008 retains professional-connection messaging, blocking, rate limiting, transport, and reports.
- Feature 013 accepts recruitment report evidence only through its protected review path.
- Feature 019 resolves participant notifications to the application thread and excludes Owners.
- Feature 024 membership lifecycle immediately changes recruitment authority.

## Complexity Tracking

| Decision | Why needed | Simpler alternative rejected because |
|---|---|---|
| Separate application-keyed aggregate | Preserves one candidate-visible history across staff reassignment and safe Owner oversight. | Pair-keyed conversations fragment history and cannot model non-participant Owner access. |
