# Feature Specification: Company Member Management

> Active HR Managers and Recruiters may be selected as recruitment-thread assignees only within their own company. Owners retain company-scoped read-only oversight and are never a recruitment-thread participant.

**Feature Branch**: `024-company-member-management`  
**Created**: 2026-08-19  
**Status**: Ready for planning

## User Scenarios & Testing

### User Story 1 - View the company team (Priority: P1)

As an active company owner, I can open a Team page and see every current or suspended company member, their role, status, and safe account identity so I can manage company access.

**Independent Test**: An owner can see only members of their company; a non-owner cannot retrieve the list.

**Acceptance Scenarios**:

1. **Given** an active owner, **When** they open Team, **Then** active and suspended members are shown with name, email, role, and status.
2. **Given** an HR Manager or Recruiter, **When** they open the owner-only Team management route, **Then** management data and actions are unavailable.

---

### User Story 2 - Invite a team member (Priority: P1)

As an active owner, I can invite an existing account by email as a Recruiter or HR Manager so that the person can join the company after accepting.

**Independent Test**: An owner sends an invitation and the recipient accepts it to become an active member with the selected role.

**Acceptance Scenarios**:

1. **Given** an owner enters an eligible account email and selects Recruiter or HR Manager, **When** they send an invitation, **Then** a single pending invitation is created and the recipient receives a safe notification/link.
2. **Given** the invited account accepts a valid, unexpired invitation, **When** acceptance succeeds, **Then** one active membership is created with the invitation's role.
3. **Given** the invited account does not want to join, **When** they decline a valid invitation, **Then** it becomes declined, cannot be accepted later, and the inviting Owner is notified.
4. **Given** an invitation is expired, revoked, declined, already used, or belongs to another account, **When** it is accepted, **Then** access is not granted.

---

### User Story 3 - Control member access (Priority: P1)

As an active owner, I can change a Recruiter or HR Manager role, suspend/restore access, or remove a member so company access stays current.

**Independent Test**: An owner changes and revokes a member's access while the affected user immediately gains or loses the corresponding server-authorized company access.

**Acceptance Scenarios**:

1. **Given** an active non-owner member, **When** the owner changes their role between Recruiter and HR Manager, **Then** the role is updated with an audit record.
2. **Given** an active non-owner member, **When** the owner suspends or removes them, **Then** company access is denied immediately; restore is available only for suspended members.
3. **Given** the sole active owner, **When** removal, suspension, or role downgrade is attempted, **Then** it is rejected.

## Edge Cases

- A pending invitation for the same email/company cannot be duplicated; an owner may revoke it and issue a new invitation.
- An active or suspended membership cannot receive another invitation for the same company.
- An Owner cannot invite, promote, demote, suspend, restore, or remove another Owner in this feature.
- Unknown, cross-company, suspended, or deleted accounts never expose membership data.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST recognize exactly three managed company roles for this feature: OWNER, HR_MANAGER, and RECRUITER; HIRING_MANAGER is not offered by owner controls.
- **FR-002**: Only an active OWNER of the selected verified company MAY list members, invite users, change managed roles, revoke invitations, suspend, restore, or remove memberships.
- **FR-003**: HR_MANAGER and RECRUITER MUST NOT manage memberships or invitations through UI or direct requests.
- **FR-004**: An invitation MUST bind one company, normalized recipient email, one allowed role, expiry, one-time acceptance, inviter, and lifecycle state.
- **FR-005**: Accepting an invitation MUST require the signed-in account email to match the invited email and MUST create or reactivate exactly one membership.
- **FR-006**: Only RECRUITER and HR_MANAGER memberships MAY be role-changed by this feature; OWNER authority and the last active owner invariant MUST remain protected.
- **FR-007**: Suspend, restore, removal, invitation, revocation, acceptance, and role change MUST be recorded in immutable audit/history data.
- **FR-008**: A suspended or removed membership MUST lose server-authorized company access immediately.
- **FR-009**: The Team UI MUST provide clear pending, active, suspended, removed, loading, error, and confirmation states with keyboard-accessible controls.
- **FR-010**: Invitation and membership data MUST be tenant-scoped and omit secrets from browser responses and ordinary logs. The acceptance link MUST be delivered only to the invited account by email; the in-app notification MUST not contain the token.
- **FR-011**: A recipient MAY explicitly decline a valid invitation. Accept and decline are terminal, compare-and-set transitions that notify the inviting Owner without exposing an acceptance token.
- **FR-012**: The Owner Team page MUST expose a tenant-scoped, immutable activity timeline for invitation and managed-membership actions, including actor, target, action, role where applicable, and timestamp.

### Key Entities

- **Company Membership**: A user’s role and lifecycle state inside one company.
- **Company Invitation**: A one-time, expiring owner-issued invitation for a known account email and allowed role.
- **Membership History**: Immutable evidence of a membership state or role change.
- **Company Team Activity**: Immutable, tenant-scoped timeline evidence for invitations and managed-membership actions.

## Success Criteria

- **SC-001**: An owner can invite an existing user and have them become an active member in under two minutes, excluding email delivery time.
- **SC-002**: 100% of tested non-owner and cross-company membership management attempts are denied without disclosing another company’s members.
- **SC-003**: A role or lifecycle change prevents unauthorized company API access on the next request.
- **SC-004**: Team management states and destructive actions are understandable and operable using keyboard-only navigation.

## Assumptions

- Recipients already have a SmartHire account; inviting unknown email addresses is deferred.
- Invitations expire after seven days and use the existing notification/email infrastructure.
- Owner transfer, job assignment, offer approval, billing, and detailed recruitment permissions are outside this feature.
- The existing HIRING_MANAGER records remain supported for backward compatibility but are not created or managed by the new UI.
