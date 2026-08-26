# Notification Deep-Link Audit

**Date:** 2026-08-16  
**Scope:** `web/src/backend/notifications/event-policy.ts` and its notification API and UI consumers.

## Current flow

`buildNotification()` validates an event and calls the private `hrefForContext(kind, contextType, contextId)` function. The returned string is persisted as `InAppNotification.href`; `NotificationService.listForUser()` returns it and the notification center consumes it. Thus navigation is decided at notification creation time, rather than from current resource state at read time. `variables.audience` is render-copy metadata only and is not an input to `hrefForContext`.

## Current NotificationKind -> href mapping

The policy table supplies category/copy for every `NotificationKind`; routing is shared by context rather than defined per kind. Consequently every kind below is `null` when its producer omits either context value.

| Kind(s) | Current context route | Audit finding |
|---|---|---|
| `EMAIL_CHANGE_REQUESTED_ALERT`, `PASSWORD_CHANGED`, `RECOVERY_PENDING`, `RECOVERY_CANCELLED`, `RECOVERY_COMPLETED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_REINSTATED`, `ALL_SESSIONS_REVOKED` | `ACCOUNT` -> `/profile/security` | Correct destination family, but href is persisted and ignores role/state. |
| `MEMBERSHIP_SUSPENDED`, `MEMBERSHIP_RESTORED`, `MEMBERSHIP_REMOVED` | `MEMBERSHIP` -> `/recruiter` | Not audience-aware; lost membership remains a stale recruiter link. |
| `APPLICATION_SUBMITTED`, `APPLICATION_STAGE_CHANGED` | `APPLICATION` -> `/jobs/applied/:applicationId` | Candidate route only; no current access/state check at resolution. |
| `APPLICATION_RECEIVED` | `APPLICATION` -> `/recruiter` | Recruiter route is broad and has no job/application filter; determined by kind, not recipient role. |
| `VERIFICATION_RECEIVED`, `VERIFICATION_CHANGES_REQUESTED`, `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, `VERIFICATION_CANCELLED`, `VERIFICATION_DELAYED`, `VERIFICATION_EXPIRED`, `VERIFICATION_REVIEW_OVERDUE` | `VERIFICATION_REQUEST` -> `/dashboard/employer-verification` | Admin and recruiter audiences share one route despite different duties. |
| `SUPPORT_WAITING_FOR_USER`, `SUPPORT_RESOLVED`, `SUPPORT_CASE_RECEIVED`, `SUPPORT_REQUESTER_REPLIED`, `SUPPORT_CASE_REOPENED` | `SUPPORT_CASE` -> `/support` | No case detail or audience filtering. |
| `CONNECTION_PROPOSAL_CREATED`, `CONNECTION_PROPOSAL_UPDATED`, `CONNECTION_PROPOSAL_INACTIVE`, `CONNECTION_ACCEPTED`, `CONNECTION_REVOKED` | `CONNECTION_PROPOSAL`/`CONNECTION` -> `/connections` | Broad list; stale but low-risk. |
| `MESSAGE_RECEIVED` | `CONVERSATION` -> `/messages?conversation=:conversationId` | Correct conversation shape, but static href and no current membership validation before API serves it. |
| `MESSAGE_REPORT_RECEIVED`, `MESSAGE_REPORT_RESOLVED`, `MESSAGE_REPORT_DISMISSED`, `MODERATION_REPORT_RECEIVED`, `MODERATION_REPORT_RESOLVED`, `MODERATION_REPORT_DISMISSED`, `MESSAGE_REPORT_RECEIVED_ADMIN`, `MODERATION_REPORT_RECEIVED_ADMIN` | `MODERATION_REPORT` -> `/admin/moderation/reports/:reportId` | Admin-only destination is selected solely by context; ordinary report notifications may expose an unusable admin link. |
| `DELIVERY_MANUAL_INTERVENTION_REQUIRED` | `DELIVERY_FAILURE` -> `/admin/notification-delivery` | Admin route not audience-aware. |
| `JOB_POST_REVIEW_REQUESTED_ADMIN` | `JOB_POST_REVIEW` -> `/admin/job-post-reviews/:reviewId` | Admin route selected by kind, persisted. |
| `JOB_POST_APPROVED`, `JOB_POST_REJECTED` | `JOB_POST_REVIEW` -> `/recruiter/job-postings?review=:reviewId` | Recruiter editor/list destination is static; no current review/post availability decision. |

## Missing or frontend-derived behavior

- Context types not handled by `hrefForContext` intentionally return `null`; the UI currently treats all items as read-state interactions and has no explicit deep-link affordance contract.
- `href` is a persisted field despite `contextType` and `contextId` already being stored. This permits stale routes after archive, hide, resolve, deletion, or access revocation.
- The frontend receives a generic `href` and has no destination-state discrimination, no grouped notification list query contract, and no specified recovery after an optimistic read mutation fails.
- The current route function has no `recipientRole` input. The same `APPLICATION` context produces a recruiter or candidate route based on `kind`, which is insufficient for a user with multiple roles and does not generalize to administrators.

## Decision carried into the feature

The existing `href` column is retained only for backward compatibility during rollout and is no longer written as the source of truth. Notification list serving resolves `href` from `contextType`, `contextId`, recipient role, occurrence count, and live authorized resource state. A null result is an intentional non-navigation action and does not change the mark-read behavior.
