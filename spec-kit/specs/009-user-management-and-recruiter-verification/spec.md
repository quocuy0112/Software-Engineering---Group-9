# Specification Index: Admin User Management and Recruiter Verification

**Feature Branch**: `009-user-management-and-recruiter-verification`  
**Created**: 2026-08-12  
**Status**: Planned — Ready for implementation review  
**Input**: Define Admin user management and recruiter verification sequentially
as three independently reviewable functional-group speckits. Do not produce
implementation output until the specifications have been reviewed and confirmed.

## Specification Structure

This file is the feature index. Each functional group has its own complete
speckit as a peer file in this directory; no group-specific directory is used.

| Order | Functional group | Specification | Status |
|---|---|---|---|
| 1 | User Account Directory | [Group 1](./spec-group-1-user-account-directory.md) | Planned; ready for implementation review |
| 2 | Business Verification Approval | [Group 2](./spec-group-2-business-verification-approval.md) | Planned; ready for implementation review |
| 3 | Account Suspension & Restoration | [Group 3](./spec-group-3-account-suspension-restoration.md) | Planned; ready for implementation review |

Specification quality is recorded in one shared
[requirements checklist](./checklists/requirements.md), with results identified
per functional group.

## Shared Product Rules

- Every normal account retains a base Candidate identity. Recruiter capability
  is additional company-scoped authority granted through an approved membership.
- Platform Administrator authority is separate from Candidate identity and
  company membership.
- Group 1 reads account and authority state; Group 2 may grant company-scoped
  recruiter authority; Group 3 may change account lifecycle only.
- Account suspension and company-membership suspension are different actions.
  Group 3 does not rewrite membership records.
- Group 3 cannot target an account while it holds current Platform
  Administrator authority; that authority must first be revoked through its
  separate authorized workflow.
- Suspension does not automatically alter job visibility or existing
  applications. Other authorized recruiters may continue processing an
  existing application through its normal workflow.
- A suspended applicant's recruiter-verification request retains its lifecycle
  state and deadlines but cannot be approved or rejected until restoration and
  revalidation make it actionable again.
- Suspend and Restore create mandatory affected-user security email, not an
  in-app notification; the suspended-login screen independently shows current
  account state and the approved support path.
- Verification approval/rejection and account suspension/restoration require an
  explicit authorized human decision. No AI or automated signal makes them.
- Protected data, business evidence, rationale, notifications, and audit records
  follow least privilege and the project constitution.

## Cross-Group Sequence

1. Group 1 locates and displays an account without changing business state.
2. Group 2 processes Candidate-submitted Become a Recruiter requests and makes
   the approved membership visible to Group 1 on its next confirmed read.
3. Group 3 suspends or restores the account itself; Group 1 reflects the new
   lifecycle state on its next confirmed read.

The existence of all three written speckits does not authorize implementation.
Planning and implementation remain a separate later task after review.

## Feature 016 Notification Integration

- Recruiter verification receipt, changes-requested, approval, rejection, cancellation, processing-delay, and expiry outcomes create one safe in-app record beside every existing email outcome.
- The in-app record contains only allow-listed state, company display name when applicable, and an internal verification-workspace destination; business-license evidence and private notes are excluded.
- Successfully displaying an applicant's own verification history clears only matching request notifications.
