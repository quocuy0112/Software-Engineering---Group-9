# Feature Specification: Identity, Authentication, and Account Recovery

**Feature Branch**: `001-identity-auth-recovery`

**Created**: 2026-07-20

**Status**: Draft

**Priority**: P0 â€” Functional Group 1

**Input**: Create secure end-to-end account creation, identity verification, login, TOTP two-factor authentication, password recovery, session management, and logout for SmartHire users.

## Constitution Compliance and Conflict Assessment

This specification was checked against the current SmartHire Constitution before implementation planning.

- **Backend technology — no conflict**: The project selects Next.js App Router Route Handlers under `app/api/**/route.ts`, with Route Handler → Service → Repository/Data Access → PostgreSQL layering. Pages Router API Routes are not used for this feature.
- **Session strategy — no conflict**: Principle VII permits one exclusive server-controlled opaque database-backed session. Better Auth is the exclusive browser-session owner; its opaque PostgreSQL-backed Session and secure cookie are the sole browser authentication mechanism. SmartHire MUST NOT create a browser JWT, a second authentication cookie, a parallel Session owner, or use the Better Auth JWT plugin as a browser-session replacement.
- **Security, audit, integrity, P0 completeness, and accessibility â€” no conflict**: The requirements below preserve server-side enforcement, secure cookies, transactional critical writes, duplicate prevention, auditable authentication events, complete P0 workflows, responsive use, and accessible feedback.
- **Actor boundary â€” no conflict**: Every normal account receives and retains the base Candidate identity. Company membership, employer verification, recruiter authority, and administrator management remain outside this functional group.

Any later plan proposing a different backend mechanism, browser-storage authentication credentials, or a second browser-session system MUST be treated as a blocking constitutional conflict.

## Clarifications

### Session 2026-07-20

- Q: Which constitutional backend and session architecture will this feature use? → A: Use Next.js App Router Route Handlers and one Better Auth opaque PostgreSQL-backed browser session; no second session system.
- Q: Is 2FA optional or role-mandatory, and is email OTP permitted? → A: TOTP is optional for all users in this group; future role mandates require a separate specification; email OTP is excluded, including recovery.
- Q: What password screening policy applies? → A: Require 12–128 characters with no composition rules and reject common or known-compromised passwords using a local/cacheable or privacy-preserving check.
- Q: What idle, absolute, and simultaneous-session limits apply? → A: 30-minute idle timeout, 7-day absolute timeout, and maximum 5 simultaneous sessions; a sixth session revokes the least recently active session.
- Q: What are the canonical account lifecycle states and transitions? → A: Pending Verification, Active, Suspended, and Deleted; Deleted is terminal for authentication and recovery, while erasure and possible email reuse follow a separately approved retention/deletion policy.

### Session 2026-07-23

- Q: What is the canonical public and protected routing? → A: `/` is the public SmartHire Home; `/home` redirects server-side to `/`; `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions` are protected; `/settings/security` redirects to `/profile/security`; `/settings/sessions` redirects to `/profile/sessions`; authenticated users may see Dashboard/Profile controls on `/`; successful full Login redirects to `/dashboard`; a provisional two-factor challenge cannot access protected routes. A Visitor opening `/` is not required to redirect to `/login`.
- Q: What does normal password reset do to two-factor authentication? → A: It updates the password through Better Auth, preserves TOTP and unused backup codes, revokes all sessions, invalidates authentication challenges, consumes the reset token exactly once, queues one idempotent notification, requires a new login, and leaves the existing TOTP or backup-code requirement enabled. It MUST NOT disable 2FA.
- Q: How does a user recover an account after losing the password, TOTP access, and backup codes? → A: A separate full account-recovery workflow uses verified-email confirmation, an enumeration-safe request, HMAC-digested single-use proofs, a 24-hour security hold, session/challenge revocation, login blocking while pending, one-time cancellation proof, password change after the hold, and 2FA/backup-code disablement only at completion. It never automatically logs the user in, emits notification and durable audit records, and documents email-only recovery as lower assurance.
- Q: What happens when password-reset steps cross Better Auth and SmartHire persistence boundaries? → A: The reset is an idempotent fail-closed saga with a token claim, durable audit intent, Better Auth password update, session revocation, challenge invalidation, notification enqueue, and finalization. Retries resume the claimed operation; concurrent submissions have one winner; partial mandatory cleanup leaves login blocked until cleanup completes. No single cross-provider database transaction is claimed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 â€” Register an Account (Priority: P1)

As a Visitor, I want to create an account with my name, email address, and password so that I can begin using SmartHire as a Candidate after verifying my email.

**Why this priority**: Registration establishes the base identity required by every subsequent Candidate workflow.

**Independent Test**: Submit valid and invalid registration forms and verify generic responses, unique account creation, Candidate assignment, Pending Verification state, and verification-email behavior without establishing a full authenticated session.

**Acceptance Scenarios**:

1. **Successful registration** â€” **Given** a Visitor supplies a valid name, a previously unused email with mixed case or surrounding whitespace, and matching valid passwords, **When** registration is submitted once, **Then** exactly one account is transactionally created with the normalized email, Pending Verification state, and base Candidate identity; a verification request valid for 24 hours is issued; the email is queued for delivery; a generic check-email response is shown; and no full authenticated session exists.
2. **Registration using an existing email** â€” **Given** an account already owns the normalized email, **When** a Visitor registers using an equivalent case or whitespace variation, **Then** no duplicate account is created, the externally observable response is materially indistinguishable from successful registration, and no account-existence detail is disclosed.
3. **Invalid registration input** â€” **Given** the name, email, password, or confirmation violates a stated rule, **When** registration is submitted, **Then** no account or token is created, field-associated validation identifies the invalid fields without exposing account existence, and valid non-sensitive values remain available for correction.

---

### User Story 2 â€” Verify an Email Address (Priority: P1)

As a Registered User, I want to verify my email through a secure link so that I can activate my account and become eligible to log in.

**Why this priority**: Verification establishes control of the registered address and gates authenticated access.

**Independent Test**: Exercise valid, expired, reused, invalid, and resent verification links and observe account state, rate limits, and success/failure pages.

**Acceptance Scenarios**:

1. **Successful verification** â€” **Given** an account in Pending Verification and its unused verification link issued less than 24 hours ago, **When** the link is opened, **Then** the token is validated, consumed once, the email is transactionally marked verified, and the user reaches a clear success page leading to normal login.
2. **Expired verification link** â€” **Given** a verification token is more than 24 hours old, **When** the link is opened, **Then** verification is rejected, account state is unchanged, the token cannot be used, and a clear failure page offers a safe resend action.
3. **Verification-link reuse** â€” **Given** a token has already completed verification, **When** the same link is opened again, **Then** it is rejected without changing account state or creating a session, and a clear non-sensitive failure result is shown.
4. **Verification-email resend throttling** â€” **Given** resend requests exceed the configured account/IP/time-window allowance, **When** another request is submitted, **Then** no additional email is sent during the limited interval, the response does not disclose account existence, and the user receives a retry-later outcome.

---

### User Story 3 â€” Log In (Priority: P1)

As a verified Registered User, I want to log in with my email and password so that I can securely access my account.

**Why this priority**: Login is the entry point to every protected SmartHire workflow.

**Independent Test**: Attempt login across valid, invalid, unverified, suspended, throttled, and already-authenticated states, with and without 2FA enabled.

**Acceptance Scenarios**:

1. **Successful login without 2FA** â€” **Given** a verified, active account without 2FA, **When** the user supplies the correct normalized email and password within rate limits, **Then** a new authenticated session is created only after credential validation, its identifier is rotated, success is audited, and the user is redirected to an authorized destination.
2. **Login with an unverified email** â€” **Given** an account in Pending Verification, **When** correct credentials are submitted, **Then** no authenticated session is created, the attempt is audited, and the response directs the user toward verification without exposing additional account data.
3. **Invalid credentials** â€” **Given** an unknown email or a known email with the wrong password, **When** login is attempted, **Then** both cases receive the same generic invalid-email-or-password message, no authenticated session is created, and the failed event contains no credential secrets.
4. **Login throttling** â€” **Given** failed attempts exceed the configured account/IP/time-window allowance, **When** another attempt occurs, **Then** authentication is delayed or rejected for the configured interval, the response remains generic, and the throttling event is auditable without permanently locking the account solely because of these attempts.

---

### User Story 4 â€” Enable TOTP Two-Factor Authentication (Priority: P2)

As an Authenticated User, I want to enable RFC 6238-compatible TOTP using Google Authenticator or another compatible authenticator so that my account has additional protection.

**Why this priority**: TOTP reduces account-takeover risk after the core verified-password flow exists.

**Independent Test**: Start enrollment after recent authentication, validate current-password and initial-code gates, and verify that enablement and backup-code issuance occur only after a valid initial code.

**Acceptance Scenarios**:

1. **Successful 2FA enrollment** â€” **Given** an Authenticated User has recently authenticated and confirms the current password, **When** the user scans the QR code or enters the manual key and submits a valid six-digit code for the unique 30-second-step secret, **Then** 2FA is enabled transactionally, one-time backup codes are shown exactly once, secrets are not logged, and enablement is audited.
2. **Invalid initial TOTP verification** â€” **Given** enrollment is pending, **When** an invalid, malformed, or out-of-window initial code is submitted, **Then** 2FA remains disabled, backup codes are not issued, the failure is generic and rate-limited, and the pending secret is not exposed.

---

### User Story 5 â€” Complete Login with TOTP or a Backup Code (Priority: P2)

As a user with 2FA enabled, I want to prove a second factor after my password is accepted so that I can complete authentication.

**Why this priority**: Enrollment is not protective unless every subsequent login enforces the second factor safely.

**Independent Test**: Complete password verification and then test valid, invalid, expired, throttled, backup-code, and replay paths while checking that no full session exists prematurely.

**Acceptance Scenarios**:

1. **Successful 2FA login** â€” **Given** an active verified account with 2FA and a live restricted pre-authentication challenge, **When** a valid six-digit TOTP code is supplied within the accepted time window, **Then** the challenge is consumed, the full authenticated session is created with a rotated identifier, and second-factor success is audited.
2. **Invalid and expired TOTP challenges** â€” **Given** a code is invalid or the restricted challenge has expired or already been consumed, **When** completion is attempted, **Then** no authenticated session is created, a generic failure is shown, repeated attempts are limited, and the failure is audited without logging the code.
3. **Successful backup-code login** â€” **Given** a live restricted challenge and an unused valid backup code, **When** that backup code is submitted, **Then** it is transactionally consumed, a full authenticated session is created, and the backup-factor success is audited without storing the submitted code in logs.
4. **Backup-code reuse rejection** â€” **Given** a backup code was previously consumed, **When** it is submitted again, **Then** authentication fails generically, no full session is created, and the failed second-factor event is audited.

---

### User Story 6 â€” Manage Two-Factor Authentication (Priority: P2)

As an Authenticated User, I want to disable 2FA or regenerate backup codes so that I can safely manage account security.

**Why this priority**: Users require a secure maintenance path to avoid unmanaged lockout and stale recovery credentials.

**Independent Test**: Attempt disabling and regeneration with fresh/stale authentication, correct/incorrect passwords, valid/invalid second factors, and verify code invalidation and audit records.

**Acceptance Scenarios**:

1. **Given** an Authenticated User has recently authenticated, confirms the current password, and supplies a valid TOTP code or completes an approved recovery procedure, **When** 2FA disablement is confirmed, **Then** the TOTP secret and all backup codes become unusable, relevant sessions are rotated or revalidated, and the action is audited.
2. **Given** an Authenticated User has recently authenticated and confirms the required security checks, **When** backup codes are regenerated, **Then** every previous backup code is invalidated transactionally, new codes are displayed once, and regeneration is audited.

---

### User Story 7 â€” Request a Password-Reset Link (Priority: P1)

As a user who forgot a password, I want to request a reset link through email so that I can regain access without disclosing whether an account exists.

**Why this priority**: Account recovery is essential to continued access and reduces unsafe support workarounds.

**Independent Test**: Submit known and unknown emails, cross rate-limit boundaries, and simulate email-delivery failure while verifying identical public outcomes and unchanged account access state.

**Acceptance Scenarios**:

1. **Successful password-reset request** â€” **Given** an active account matches the normalized email and request limits allow it, **When** a reset is requested, **Then** one secure single-use reset request valid for 30 minutes is issued, a URL based only on the trusted configured application address is queued for email delivery, the account remains otherwise unchanged, and a generic response is shown.
2. **Password-reset request for a nonexistent email** â€” **Given** no account matches the normalized email, **When** a reset is requested, **Then** no account or usable reset token is created and the timing and content of the response are materially indistinguishable from the response for an existing account.

---

### User Story 8 â€” Reset a Password (Priority: P1)

As a user with a valid password-reset link, I want to choose a new password so that I can recover my account securely.

**Why this priority**: A request flow provides no recovery value unless reset completion is safe, single-use, and revokes compromised sessions.

**Independent Test**: Use valid, expired, invalid, reused, concurrent, and failure-injected reset submissions; verify one durable saga owner, Better Auth password replacement, all-session and challenge revocation, one notification enqueue, retained TOTP and unused backup codes, fail-closed retry, and required normal login with the retained second factor.

**Acceptance Scenarios**:

1. **Expired reset link** â€” **Given** a reset token is more than 30 minutes old, **When** a reset is submitted, **Then** the token is rejected, the password and sessions remain unchanged, and a clear failure page offers a new generic reset request.
2. **Reset-token reuse** â€” **Given** a reset token has already been consumed, **When** another reset is submitted with it, **Then** the request is rejected without changing credentials or sessions and no secret token value is logged.
3. **Password reset and session revocation** â€” **Given** an unused unexpired token and matching new passwords satisfying policy, **When** reset is submitted, **Then** one durable fail-closed reset saga claims the token, records its audit intent, updates the password through Better Auth, revokes all sessions, invalidates authentication challenges, enqueues one idempotent security notification, finalizes exactly once, and directs the user to normal login without automatic authentication.
4. **Two-factor preservation** - **Given** TOTP is enabled and unused backup codes exist before a normal reset, **When** the reset saga finalizes, **Then** the TOTP secret and unused backup codes remain unchanged and the next login still requires the existing TOTP or one unused backup code.
5. **Partial failure and retry** - **Given** any mandatory reset step fails after token claim, **When** the request ends or is retried with the same proof and new password, **Then** no success is claimed, login remains blocked, the same durable operation resumes idempotently, completed effects are not duplicated, and finalization occurs only after password update, session revocation, challenge invalidation, and notification enqueue are confirmed.
6. **Concurrent reset** - **Given** two submissions race with the same reset proof, **When** both attempt reset, **Then** exactly one durable operation owns the token claim, both executions converge on that operation, and no second notification, audit completion, or credential outcome is created.

---

### User Story 9 â€” Manage Sessions and Logout (Priority: P1)

As an Authenticated User, I want to review and revoke sessions or log out so that I can protect my account across devices.

**Why this priority**: Users must be able to terminate access immediately when a device or session is no longer trusted.

**Independent Test**: List sanitized session metadata, log out the current session, revoke another session, and attempt to reuse invalidated credentials.

**Acceptance Scenarios**:

1. **Current-session logout** â€” **Given** an Authenticated User has an active session, **When** logout is requested, **Then** the authoritative server-side session is invalidated, the authentication cookie is cleared with matching scope, subsequent use is rejected, and the logout/revocation result is audited.
2. **Revocation of another session** â€” **Given** an Authenticated User views multiple active sessions without exposed token values, **When** a different owned session is revoked, **Then** that session immediately loses authenticated access, the current session remains active, and the actor, target session reference, result, time, and non-sensitive context are audited.

---

### User Story 10 - Navigate Public Home and the Identity Workspace (Priority: P1)

As a Visitor or Authenticated User, I want a canonical public Home and consistent navigation between identity pages and protected account pages so that I can understand where I am and reach the next safe action without guessing URLs.

**Why this priority**: Registration, recovery, security, and session management form one account workflow. Isolated pages make otherwise complete security features difficult to discover and use.

**Independent Test**: Open public `/`, follow `/home` to `/`, use public authentication links, authenticate, move between `/dashboard`, Profile, Security, and Sessions using the shared workspace navigation, then sign out and confirm protected pages are unavailable while `/` remains public.

**Acceptance Scenarios**:

1. **Public Home and compatibility route** - **Given** a Visitor or Authenticated User opens `/`, **When** the page renders, **Then** the canonical public SmartHire Home is shown; authenticated users may additionally see Dashboard/Profile controls, and `/home` server-redirects to `/` without exposing protected content.
2. **Public authentication navigation** - **Given** a Visitor is on Login, Register, Forgot Password, Reset Password, Check Email, Verify Email, or the two-factor challenge, **When** the user follows a related navigation action, **Then** the destination is an approved internal route and no account, token, verification, reset, or factor state is disclosed.
3. **Protected workspace navigation** - **Given** an Authenticated User enters `/dashboard` or any Profile destination, **When** the page renders, **Then** one server-validated authenticated workspace shell exposes SmartHire branding, Dashboard, Profile, a safe account control, active-page state, and Sign out without creating or persisting a second client authentication state.
4. **Successful login destination and challenge boundary** - **Given** Login succeeds fully, **When** no second factor is required or the two-factor challenge completes, **Then** the user is redirected to `/dashboard`; a provisional challenge alone cannot access `/dashboard` or any Profile route.
5. **Foundational dashboard** - **Given** an Authenticated User opens `/dashboard`, **When** the dashboard renders, **Then** it provides safe identity-workspace guidance and quick links while future Candidate or Recruiter capabilities are clearly marked unavailable and no fabricated business data is displayed.
6. **Responsive keyboard navigation** - **Given** a 320 CSS-pixel viewport or keyboard-only operation, **When** the user opens and uses the public or protected navigation, **Then** every control remains labelled, focus-visible, operable, non-overflowing, and understandable without color alone.

---

### User Story 11 - Manage One Unified Authenticated Profile (Priority: P1)

As an Authenticated User, I want my account overview, password-recovery entry
point, two-factor controls, backup codes, and sessions grouped under Profile so
that security management is discoverable without exposing credentials or
creating another client authentication state.

**Why this priority**: The existing security capabilities are implemented, but
separate settings destinations make them harder to discover and increase the
risk of inconsistent navigation or accidental TOTP re-enrollment.

**Independent Test**: Authenticate, open Profile from the account control,
navigate directly and with Back/Forward between Overview, Security, and
Sessions, exercise 2FA management with a renewed current-password proof, then
sign out and confirm all Profile routes reject the prior session.

**Acceptance Scenarios**:

1. **Public Home and protected Dashboard routing** - **Given** a Visitor opens `/`, **When** no valid ACTIVE Better Auth session exists, **Then** the public SmartHire Home renders without redirecting to Login; given any user opens `/dashboard`, `/profile`, `/profile/security`, or `/profile/sessions`, **Then** the server protects the destination before rendering content, and a valid session renders the destination without a client authentication flash.
2. **Safe account control** - **Given** an Authenticated User sees the workspace shell, **When** the header renders, **Then** a safe user icon and display name link to /profile without exposing a session token, raw session identifier, factor material, or client-stored authorization state.
3. **Directly addressable Profile areas** - **Given** an Authenticated User, **When** they visit /profile, /profile/security, or /profile/sessions, **Then** the URL identifies Overview, Security, or Sessions, the active tab is programmatic, and browser Back/Forward works.
4. **Legacy settings compatibility** - **Given** an old internal link to /settings/security or /settings/sessions, **When** it is requested, **Then** a server redirect reaches /profile/security or /profile/sessions without preserving query strings or secret parameters.
5. **2FA state-safe management** - **Given** 2FA is disabled, **When** Security renders, **Then** enrollment may produce a protected local QR/manual key; **Given** 2FA is enabled, **When** Security renders, **Then** only management controls are offered and no replacement secret is generated until an explicitly approved enrollment action exists.
6. **Renewed proof and session rotation** - **Given** an ACTIVE session older than the recent-auth interval, **When** the user supplies the correct current password for a sensitive 2FA action, **Then** that password renews proof for the request; successful Better Auth enrollment or disablement forwards its replacement session cookie to the browser.
7. **Accessible password visibility** - **Given** any supported password field, **When** the user toggles visibility, **Then** an eye/eye-off icon changes the input type while a descriptive accessible name, pressed state, keyboard operation, paste, and autocomplete remain intact.

---

### User Story 12 - Complete Full Account Recovery After Loss of All Factors (Priority: P1)

As a user who has lost the password, TOTP access, and backup codes, I want a
separately controlled recovery process so that verified email can begin a
lower-assurance recovery without silently bypassing the security hold or
creating an automatic session.

**Why this priority**: Normal password reset must preserve 2FA, so users who
lose every factor need an explicit, auditable, higher-friction recovery path.

**Independent Test**: Request recovery with known and unknown email addresses,
confirm a disposable account through its email proof, verify the 24-hour hold,
test login blocking and one-time cancellation, then complete after the hold and
verify password replacement, old 2FA/backup-code disablement, notifications,
audit records, and required new login.

**Acceptance Scenarios**:

1. **Enumeration-safe request** - **Given** any email address, **When** a full
   recovery request is submitted, **Then** the response and timing are
   materially indistinguishable, and only an eligible account receives a
   confirmation message with no proof value logged.
2. **Verified-email confirmation and hold** - **Given** a valid unexpired
   HMAC-digested single-use confirmation proof, **When** it is consumed,
   **Then** one durable recovery operation enters a 24-hour security hold,
   existing sessions and authentication challenges are revoked, a completion
   proof and one-time cancellation proof are issued safely, and the operation
   is audited.
3. **Pending recovery login block** - **Given** recovery is pending or inside
   its hold, **When** password or second-factor login is attempted, **Then** no
   session or provisional challenge is created and the generic blocked outcome
   is returned without revealing recovery details.
4. **Cancellation** - **Given** a valid unused cancellation proof before the
   hold ends, **When** cancellation is submitted, **Then** the operation is
   durably cancelled once, the proof cannot be reused, the user is notified,
   and ordinary login remains governed by the account's existing credentials.
5. **Post-hold completion** - **Given** the hold has elapsed and a valid
   completion proof is supplied with a policy-compliant new password, **When**
   recovery completes, **Then** Better Auth changes the password, old TOTP and
   backup codes are disabled only in this completion step, sessions and
   challenges are revoked, notification and durable audit records are written,
   no session is created automatically, and a subsequent login is required.
6. **Lower assurance disclosure** - **Given** the recovery UI or notification
   describes the workflow, **Then** it explicitly states that email-only
   recovery is lower assurance than possession of the original password and
   second factor.

---

### Cross-Cutting Acceptance Scenarios

1. **Email-service failure** â€” **Given** registration, verification resend, normal password reset, full recovery, or security notification has committed valid core data, **When** the Transactional Email Service is unavailable, **Then** account and credential data remain consistent, no duplicate critical record is created by retry, unrelated workflows remain available, delivery is retried or reported through an operationally visible non-secret failure, and the user sees a safe recoverable state.
2. **Database-write or provider failure** â€” **Given** a critical registration, verification, 2FA, normal password-reset saga, full-recovery, or session-revocation step begins, **When** persistence or Better Auth work fails before completion, **Then** the operation rolls back where one provider controls the write or remains in a durable fail-closed retry state across providers, the interface reports failure without claiming success, no partial security state grants access, mandatory reset cleanup blocks login until complete, and the failure is audited where persistence remains available.
3. **Keyboard and mobile accessibility** â€” **Given** each required page at supported mobile and desktop widths, **When** a user navigates using only a keyboard and completes its primary flow, **Then** every control is reachable in logical order, focus is visible, labels and status messages are programmatically associated, state is not conveyed by color alone, the 2FA transition moves focus to the challenge heading or first field, reduced-motion preferences are respected, and no horizontal scrolling is required at a 320 CSS-pixel viewport except for content that intrinsically requires it.

4. **Asynchronous transactional email** - **Given** registration, verification resend, password reset, or a security notification commits valid core data and its Email Delivery Job, **When** the selected Transactional Email Service is slow or unavailable, **Then** the originating HTTP request completes without waiting for external delivery, the committed job remains operationally visible and safely retryable, and no provider secret or complete token is logged.

### Edge Cases

- Concurrent registrations using equivalent normalized emails result in at most one account; all public responses remain generic.
- Unicode names, spaces, and passwords are accepted subject to length and safety validation; password length is measured consistently as user-perceived characters and must not be silently truncated or normalized into a different password.
- Passwords of exactly 12 and 128 characters are accepted; 11 or 129 characters are rejected.
- A verification or reset token submitted concurrently can succeed at most once.
- Requesting a new verification token invalidates previously active verification links for the account, while repeated delivery retries do not create multiple usable tokens.
- Email links with missing, malformed, altered, used, or expired tokens produce safe failure pages and never expose token representations.
- A suspended account cannot obtain a full session through password, TOTP, backup code, or an already-issued pre-authentication challenge.
- A pre-authentication challenge cannot access ordinary authenticated resources, cannot be upgraded for another account, and expires after the configured short-lived interval.
- Codes near a 30-second TOTP boundary follow one documented, limited clock-skew window and cannot be replayed to complete the same challenge twice.
- Concurrent use of one backup code succeeds at most once.
- Loss of the TOTP device and all backup codes routes the user to a separately controlled approved recovery procedure; support personnel cannot simply disable 2FA without verified authorization and audit.
- Changing the password or 2FA security state rotates or revalidates affected session identifiers and recent-authentication state.
- Idle and absolute session expiration are enforced by the server even if the cookie remains in the browser.
- Session listings distinguish the current session using non-sensitive metadata such as approximate device/browser, creation time, last-active time, and approximate location when lawfully available; raw credentials and full IP addresses are not displayed.
- Duplicate form submissions, browser retries, and email-worker retries do not create duplicate accounts, tokens, backup-code sets, notifications, or audit side effects.
- Concurrent email workers cannot successfully claim or deliver the same due Email Delivery Job more than once; an interrupted claim becomes safely retryable according to a documented recovery interval.
- Back-button navigation after logout, reset, or 2FA completion cannot restore protected content without a valid server-authorized session.
- A normal reset never disables TOTP or invalidates unused backup codes; after reset, a new login still requires the existing second factor when 2FA remains enabled.
- A reset saga token claim has one durable operation owner; concurrent submissions cannot produce a second logical password outcome or enqueue the notification twice, and a claimed operation can be retried idempotently until mandatory cleanup and finalization complete.
- During a full account-recovery hold, password login and second-factor completion are blocked, existing sessions and challenges remain revoked, and cancellation succeeds only with the single-use cancellation proof before the hold ends.
- Full recovery completion changes the password and disables old TOTP/backup credentials only once, after the 24-hour hold; it never creates an authenticated session automatically.

## Requirements *(mandatory)*

### Functional Requirements

#### Registration and Identity

- **FR-001**: The system MUST provide `/register` for Visitors and redirect Authenticated Users away from registration and login pages to an authorized destination.
- **FR-002**: Registration MUST accept a name, email, password, and password confirmation; validate all values at the server trust boundary; preserve valid non-sensitive values after recoverable errors; and prevent duplicate submissions.
- **FR-003**: The system MUST normalize email addresses consistently before lookup and storage and MUST enforce normalized email uniqueness through an authoritative constraint or equivalent idempotency control.
- **FR-004**: A successfully created normal account MUST have an unverified email state and retain the base Candidate identity.
- **FR-004A**: The canonical account states MUST be Pending Verification, Active, Suspended, and Deleted. Successful registration creates Pending Verification; successful email verification changes Pending Verification to Active; Active may become Suspended; Suspended may return to Active; and any non-deleted state may become Deleted only through an authorized workflow.
- **FR-004B**: Deleted MUST be terminal for authentication and account recovery. Transition to Deleted MUST revoke all sessions and invalidate outstanding verification, reset, pre-authentication, TOTP, and backup-code credentials. Personal-data erasure and any later release of the normalized email MUST follow a separately approved retention/deletion policy and are not defined by this functional group.
- **FR-005**: Registration responses MUST NOT disclose whether the submitted email is already registered and MUST NOT establish a full authenticated session before verification.
- **FR-006**: Account creation, base identity assignment, issuance of the initial verification request, and creation of its Email Delivery Job MUST preserve all-or-nothing critical state. The originating registration request MUST complete after this transaction commits and MUST NOT wait for external email delivery; delivery failure MUST NOT corrupt or duplicate account data.

#### Email Verification

- **FR-007**: Email verification tokens MUST be generated with cryptographically secure unpredictability, stored only as secure non-reversible representations, treated as secrets, single-use, and expired 24 hours after issuance.
- **FR-008**: `/verify-email` MUST mark an email verified only after successful token validation and MUST reject missing, malformed, invalid, used, superseded, and expired tokens.
- **FR-009**: `/check-email` MUST explain the next step without confirming account existence and MUST offer a resend action with generic responses.
- **FR-010**: Resend requests MUST be rate-limited by relevant account/email, IP address, and time window; issuance MUST avoid multiple concurrently usable verification tokens for one account.
- **FR-011**: Verification outcomes MUST lead to clear, accessible success or failure pages, and successful verification MUST direct the user to normal login rather than silently establishing a full session.

#### Password Authentication

- **FR-012**: `/login` MUST authenticate verified, active accounts using normalized email and password and MUST use the same generic invalid-email-or-password response for unknown email and wrong password.
- **FR-013**: Login MUST reject unverified and suspended accounts without creating a full session; user guidance MUST not disclose data beyond what the requestor already supplied or proved.
- **FR-014**: Registration and login attempts MUST be rate-limited using documented account/email, IP, and time-window controls that resist distributed abuse while allowing legitimate recovery.
- **FR-015**: The system MUST record successful and failed password-authentication events without logging emails unnecessarily, passwords, submitted codes, session credentials, or complete tokens.
- **FR-016**: For accounts without 2FA, the authenticated session MUST be created only after all password and account-state checks pass.

#### TOTP Enrollment and Management

- **FR-017**: Canonical Profile Security at `/profile/security` MUST require a valid ACTIVE session and current-password confirmation before starting TOTP enrollment, disabling TOTP, or regenerating backup codes; `/settings/security` is a compatibility redirect only.
- **FR-017A**: TOTP enrollment MUST be optional for every user covered by this functional group. No role in this group is required to enable 2FA; a future role-based mandate requires separate approval and specification.
- **FR-018**: TOTP enrollment MUST create a unique secret per account, strongly protect it at rest, never log it, and display both a scannable QR code and manual setup key over a protected interaction.
- **FR-019**: TOTP MUST be compatible with RFC 6238 authenticators, use six-digit codes and a 30-second time step, and apply a documented limited clock-skew tolerance.
- **FR-020**: TOTP MUST remain disabled until the user supplies a valid initial code; failed initial checks MUST be generic, auditable, and rate-limited.
- **FR-021**: Successful enrollment MUST generate a finite set of cryptographically random one-time backup codes, store only secure representations, and display plaintext codes only once during that generation response.
- **FR-022**: Disabling 2FA MUST additionally require a valid TOTP code or an approved, separately controlled account-recovery procedure and MUST invalidate the prior TOTP secret and all backup codes.
- **FR-023**: Regenerating backup codes MUST invalidate every prior backup code before activating and displaying the new set, and concurrent regeneration MUST not leave multiple valid sets.
- **FR-024**: TOTP enablement, disablement, initial verification failures, and backup-code regeneration MUST be audited.

#### Second-Factor Login

- **FR-025**: When an account has 2FA enabled, successful password verification MUST create only a restricted, single-account, short-lived pre-authentication challenge and MUST NOT create a full authenticated session.
- **FR-026**: `/two-factor` MUST accept a valid TOTP code or unused backup code, provide accessible focus management from password login, and return generic failure messages.
- **FR-027**: Pre-authentication challenges MUST be single-use, expire after a documented short interval, permit only second-factor completion or cancellation, and be rate-limited by challenge, account, IP address, and time window.
- **FR-028**: A backup code MUST be invalidated atomically upon its first successful use; concurrent or later reuse MUST fail.
- **FR-029**: The full authenticated session MUST be created and its identifier rotated only after all required factors succeed.
- **FR-030**: Successful and failed TOTP and backup-code authentication events MUST be audited without recording submitted codes.

#### Password Policy and Recovery

- **FR-031**: Passwords MUST be 12–128 characters, accept spaces and Unicode, be evaluated without silent truncation, have confirmation enforced on registration and reset, and MUST NOT impose uppercase, lowercase, digit, or symbol composition rules.
- **FR-031A**: Registration and password reset MUST reject passwords found on the approved common-password or known-compromised-password list. The check MUST use a locally available/cacheable list or a privacy-preserving query that never discloses the complete password or reusable password hash; loss of an external checking service MUST NOT bypass the approved local/cacheable check or expose the password.
- **FR-032**: Password input interfaces MUST allow paste, use appropriate password-manager/browser autocomplete attributes, and provide a show/hide control with an accessible label.
- **FR-033**: Passwords MUST be securely hashed, never stored or logged in plaintext, and MUST NOT be subject to arbitrary periodic rotation.
- **FR-034**: `/forgot-password` MUST return materially indistinguishable responses for existing and nonexistent emails and MUST NOT change, suspend, or lock an account merely because reset was requested.
- **FR-035**: Reset requests MUST be rate-limited by account/email, IP address, and time window.
- **FR-036**: Reset tokens MUST be cryptographically unpredictable, stored only as secure non-reversible representations, single-use, and expired 30 minutes after issuance.
- **FR-037**: Reset URLs MUST be formed only from a trusted configured application URL and MUST NOT trust a request-supplied host or redirect destination.
- **FR-038**: Reset email delivery MUST use the same asynchronous Email Delivery Job lifecycle as registration, verification resend, and security notifications; delivery failure MUST preserve account integrity, support safe retry, and not disable unrelated workflows.
- **FR-039**: `/reset-password` MUST reject missing, malformed, invalid, used, superseded, and expired tokens and MUST require matching new-password confirmation satisfying FR-031.
- **FR-040**: Successful normal reset MUST update the Better Auth credential, consume the reset token exactly once, revoke every existing Better Auth session, invalidate outstanding authentication challenges, queue one idempotent password-change security notification, audit the reset without secrets, preserve TOTP and unused backup codes, and send the user to normal login without automatic authentication. Normal reset MUST NOT disable 2FA.
- **FR-040A**: Normal reset MUST execute as an idempotent fail-closed saga across SmartHire persistence and Better Auth. The ordered milestones are: (1) atomically claim the HMAC-digested token for one durable reset operation and record the audit intent; (2) update the Better Auth password without modifying Better Auth-owned TOTP or backup-code state; (3) revoke all Better Auth sessions; (4) invalidate every outstanding authentication challenge and superseded reset proof; (5) enqueue the password-change notification under a stable idempotency key; and (6) atomically finalize the operation and token lifecycle. Each milestone MUST be durably observable without storing the plaintext token or password.
- **FR-040C**: A retry MUST reacquire and resume the same claimed reset operation from its first incomplete milestone. Completed SmartHire effects MUST be idempotent; an ambiguous Better Auth result MAY be safely re-invoked only to converge on the same submitted password and MUST NOT create a session or alter 2FA. Concurrent submissions MUST have one claim owner, and the token MUST have one terminal consumption. Any partial failure MUST return a non-success result, retain a retryable durable state, and keep password login, second-factor completion, and protected access blocked until all mandatory cleanup, notification enqueue, final audit emission, and finalization complete.
- **FR-040B**: Full account recovery MUST be a separate workflow for a user who has lost the password, TOTP access, and backup codes. It MUST provide an enumeration-safe request, verified-email confirmation, HMAC-digested single-use proofs, a 24-hour security hold, session and challenge revocation, login blocking while pending, one-time cancellation proof, password change only after the hold, durable audit and notification records, and no automatic login. Old TOTP and backup codes MUST be disabled only at full-recovery completion, and the product MUST document email-only recovery as lower assurance.

#### Sessions, Authorization, Cookies, and CSRF

- **FR-041**: Better Auth MUST exclusively own the opaque PostgreSQL-backed browser session and its only authentication cookie, configured HttpOnly, SameSite, Secure in production, host-only, and Path=/; authentication credentials MUST never be stored in browser storage or client-state caches.
- **FR-042**: Every authenticated or authorized request MUST be enforced on the server and MUST validate the Better Auth session plus SmartHire account-state, idle-timeout, absolute-timeout, and revocation policy.
- **FR-043**: Sessions MUST expire after 30 minutes without qualifying activity and after 7 days regardless of activity, enforced on the server, and MUST rotate identifiers after successful authentication and privilege-sensitive security changes.
- **FR-043A**: An account MUST have at most five active authenticated sessions. Creating a sixth MUST atomically revoke the least recently active session, excluding the newly created session, and MUST audit that automatic revocation.
- **FR-044**: Sensitive actions MUST require recent authentication using a documented recency interval and renewed proof when the interval has elapsed.
- **FR-045**: State-changing authenticated requests MUST use CSRF protection appropriate to the cookie-based session strategy.
- **FR-046**: Logout MUST invalidate the current server-side session and clear the authentication cookie using the same path/domain/security scope with which it was set.
- **FR-047**: Canonical Profile Sessions at `/profile/sessions` MUST list only sessions owned by the Authenticated User, identify the current session, and show useful non-secret metadata without exposing Better Auth session tokens, raw session identifiers, complete IP addresses, or other credentials; `/settings/sessions` is a compatibility redirect only.
- **FR-048**: Users MUST be able to revoke another owned session without ending the current session; revoked and expired sessions MUST fail on their next attempted use.
- **FR-049**: Session creation, expiration where operationally relevant, logout, revocation, identifier rotation, and rejected use of revoked sessions MUST follow the audit policy.

#### Data Integrity, Privacy, Audit, and Pages

- **FR-050**: All inputs MUST be validated at the server trust boundary, and critical account, token, 2FA, password, and session writes MUST use transactions or equivalent atomic guarantees.
- **FR-051**: Database constraints or idempotency controls MUST prevent duplicate accounts, active critical tokens, backup-code consumption, session revocations, email jobs, and other duplicate critical records.
- **FR-052**: No registration, authentication, verification-resend, or password-reset response or observably different behavior may expose whether an account exists, except where a user has already authenticated or proven control of the relevant account context.
- **FR-053**: Rate-limit policy values and challenge lifetimes MUST be documented in the implementation plan, consistently enforced at the server, testable, and configurable without weakening the generic-response rules.
- **FR-054**: Audit records MUST contain actor (or anonymous request reference), action, target, result, timestamp, and relevant non-sensitive request context; they MUST exclude passwords, TOTP secrets/codes, complete tokens, backup codes, JWTs, raw session identifiers, and unnecessary personal data.
- **FR-055**: The system MUST support public SmartHire Home at `/`, a server-side `/home` redirect to `/`, public `/register`, `/check-email`, `/verify-email`, `/login`, `/two-factor`, `/forgot-password`, and `/reset-password`, protected `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions`, and server-side compatibility redirects from `/settings/security` and `/settings/sessions`. Fully successful Login MUST redirect to `/dashboard`; a provisional two-factor challenge MUST NOT authorize any protected route.

#### Transactional Email Delivery

- **FR-056**: Transactional email MUST support exactly three approved adapter roles behind the existing provider-independent email boundary: `capture` as the generated default for local development, `smtp` as an optional local-development and team-demonstration adapter, and `resend` as the approved production-oriented adapter. Production deployment remains outside the scope of this academic project.
- **FR-057**: Email adapter selection MUST use `EMAIL_ADAPTER=capture|smtp|resend` as its sole canonical server-side selector; a duplicate `EMAIL_DRIVER` selector MUST NOT be required. Registration, verification, resend, password-recovery, and notification business services MUST create Email Delivery Jobs and MUST NOT depend directly on Nodemailer, SMTP, Resend, or another provider library.
- **FR-058**: A due-outbox processor MUST asynchronously claim due `PENDING` or `RETRYABLE` Email Delivery Jobs after their originating transaction commits. Claiming MUST prevent concurrent duplicate processing, and SMTP or other external delivery MUST NOT block the originating registration, resend, recovery, or notification HTTP response.
- **FR-059**: For every claimed Email Delivery Job, the processor MUST deliver through the selected adapter, increment the attempt count, and atomically record `SENT`, `RETRYABLE`, or `DEAD`. Retryable failures MUST receive a calculated `nextAttemptAt`; failures MUST store only an approved safe error code; timeouts and temporary provider failures MUST be classified as retryable; permanent authentication, configuration, policy, or recipient rejection failures MUST be classified as terminal; and terminal exhaustion or failure MUST create a secret-free audit event.
- **FR-060**: SMTP configuration MUST be server-only and limited to `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE`, and `SMTP_USE_TLS`. No SMTP setting or credential may use a `NEXT_PUBLIC_` name, and SMTP passwords or provider credentials MUST NOT appear in source code, ordinary logs, client bundles, database records, Email Delivery Job payloads, or audit data.
- **FR-061**: Gmail-compatible SMTP MUST require a complete email address for `SMTP_USERNAME`, support Google App Password authentication, require STARTTLS with port 587 and `SMTP_SECURE=false`, and MAY support implicit TLS with port 465 and `SMTP_SECURE=true`. `SMTP_FROM` MUST contain a complete email address and reject carriage returns, line feeds, and all control characters. Missing or contradictory settings MUST fail configuration validation without exposing supplied secret values.

#### Identity Navigation and Workspace Integration

- **FR-062**: /login, /register, /forgot-password, /reset-password, /verify-email, /check-email, and /two-factor MUST use one shared public authentication shell with a SmartHire home/brand link, consistent responsive presentation, and route-appropriate safe help or return actions.
- **FR-063**: Login MUST link to Create account and Forgot password; Register MUST link to Sign in; recovery and verification result pages MUST provide an approved internal return path without disclosing account existence, factor configuration, verification state, or reset-token validity beyond the existing generic result.
- **FR-064**: `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions` MUST use one authenticated workspace shell whose server layout validates the sole Better Auth session before rendering protected navigation or content. `/` is the canonical public SmartHire Home and is not required to redirect unauthenticated visitors to `/login`. Client navigation state MUST NOT authorize access or duplicate the session.
- **FR-065**: The authenticated workspace shell MUST expose SmartHire branding, a `/dashboard` link, Profile, a safe account control, active-page state, and Sign out. Profile navigation MUST expose Overview, Security, and Sessions. Authenticated users MAY see Dashboard/Profile controls on public `/`. Ordinary internal navigation MUST use Next.js Link; router APIs are reserved for state-dependent or post-action transitions.
- **FR-066**: The foundational Dashboard MUST provide identity-workspace orientation and quick links only. Candidate profiles, job search, recommendations, recruiter workflows, applications, notifications, administration, analytics, and invented business data MUST NOT be implemented by this increment; future areas MUST be labelled as unavailable or Coming later.
- **FR-067**: Shared navigation MUST remain keyboard operable, visibly focusable, screen-reader labelled, reduced-motion safe, and free from horizontal overflow at 320 CSS pixels. A responsive menu control MUST expose its expanded state and controlled region programmatically.
- **FR-068**: Protected child pages MUST NOT duplicate workspace header/navigation markup or independently fetch a session solely to render the shell. Sign out MUST use the existing authoritative logout operation with same-origin/CSRF protection and must not expose session credentials.
- **FR-069**: `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions` MUST use a server-validated ACTIVE Better Auth session boundary. Invalid, absent, expired, revoked, Pending Verification, Suspended, Deleted, and provisional pre-auth challenge states MUST redirect safely to `/login` before protected content renders. `/` MUST render the public Home instead of requiring authentication, and `/home` MUST redirect server-side to `/`.
- **FR-070**: The authenticated workspace shell MUST expose Dashboard and Profile navigation plus a top-right safe account control containing a non-sensitive icon and display name linked to /profile; the display projection MUST NOT authorize access or contain raw session/factor credentials.
- **FR-071**: /profile, /profile/security, and /profile/sessions MUST be protected, directly linkable Profile destinations with accessible active state and browser history behavior. /settings/security and /settings/sessions MUST redirect server-side to the corresponding Profile destination without forwarding query strings or secret parameters.
- **FR-072**: Profile Security MUST expose the existing normal password-recovery entry point, Better Auth-owned TOTP enrollment or management according to authoritative account state, and one-time backup-code behavior. Normal password reset MUST preserve enabled 2FA and unused backup codes. It MUST NOT offer enrollment while 2FA is already enabled or create a parallel TOTP/backup owner.
- **FR-073**: A correct current password supplied for a sensitive action MUST serve as renewed proof when the session is older than the documented recent-auth interval. When pinned Better Auth rotates the authoritative session during TOTP enrollment or disablement, the custom Route Handler MUST forward the resulting Set-Cookie value with no-store protections.
- **FR-074**: Password visibility controls MUST use eye/eye-off visual states with descriptive accessible names and aria-pressed; they MUST remain keyboard operable and preserve the approved autocomplete, paste, validation, and password-manager behavior.

### Non-Functional Requirements
- **NFR-001 â€” Performance**: Under documented normal test conditions, each required page MUST become usable within 3 seconds for at least 95% of measured visits; the plan MUST state environment, dataset, measurement method, and external-email conditions.
- **NFR-002 â€” Responsiveness**: All required pages MUST support mobile and desktop layouts from 320 CSS pixels wide without loss of actions, labels, messages, or entered non-sensitive values.
- **NFR-003 â€” Accessibility**: Primary flows MUST satisfy WCAG 2.2 Level AA expectations for keyboard operation, visible focus, associated labels, status/error announcement, contrast, non-color cues, and reduced motion.
- **NFR-004 â€” Reliability**: A failure of the Transactional Email Service MUST not corrupt account data, activate an account in Pending Verification, consume an otherwise retryable user action incorrectly, or disable unrelated login and session management. A normal password-reset saga MUST fail closed and block login only when its mandatory cleanup is incomplete; a pending full-recovery operation MUST block login by policy.
- **NFR-005 â€” Security**: Sensitive traffic MUST use HTTPS in production; secret material MUST be protected throughout its lifecycle and excluded from ordinary application logs, analytics, URLs other than the required opaque verification/reset token, and client-side persistent storage.
- **NFR-006 â€” Privacy**: Processing and retention of account, session, request-context, and audit data MUST be purpose-limited, minimized, and handled consistently with applicable Vietnamese personal-data requirements, including Decree 13/2023/ND-CP.
- **NFR-007 â€” Availability target**: Identity flows SHOULD contribute to the projectâ€™s 99.5% availability design target; any measured claim MUST state the deployment period and exclusions.
- **NFR-008 â€” Usability**: Every submission MUST expose clear loading, success, validation, and error states, prevent duplicate form submission, preserve non-sensitive values after recoverable errors, and never communicate state using color alone.
- **NFR-009 â€” Browser assistance**: Registration, login, password reset, and TOTP interfaces MUST use semantically appropriate field purposes and autocomplete behavior so supported password managers and browsers can fill and save credentials safely.
- **NFR-010 â€” Testability**: Security timing, rate-limit, expiry, retry, transaction-failure, concurrent-use, and accessibility behavior MUST be verifiable in controlled tests without using production personal data or secrets.

- **NFR-011 - Asynchronous email reliability**: A failure or timeout of the Transactional Email Service MUST not delay completion of an originating request after its Email Delivery Job has committed. Due jobs MUST remain operationally visible until sent or terminally failed, and adapter selection, SMTP transport matrices, safe error classification, retry, timeout, concurrent claim, and secret-exclusion behavior MUST be verifiable without live external email delivery or production secrets.

- **NFR-012 - Navigation cohesion**: Dashboard, Profile Overview, Profile Security, Profile Sessions, and public authentication transitions MUST expose a visible destination landmark and complete within the Constitution dashboard-navigation target under the documented local test environment; browser tests MUST synchronize on response, URL, and destination state rather than arbitrary sleeps or networkidle.

### Key Entities

- **Account**: A SmartHire user identity with name, normalized unique email, one canonical lifecycle state (Pending Verification, Active, Suspended, or Deleted), password credential metadata, 2FA state, timestamps, and the mandatory base Candidate identity. Deleted is terminal for authentication and recovery.
- **Email Verification Request**: A single-use, time-bounded proof request associated with an account; contains a secure token representation, issuance/expiry/consumption state, and delivery status without retaining the complete token.
- **Password Reset Request**: A single-use, 30-minute recovery request associated with an eligible account; contains a secure token representation, lifecycle state, and delivery status without changing account access merely on issuance.
- **Password Reset Operation**: The durable idempotency and recovery record for one claimed normal-reset proof. It identifies the owning token digest and account, ordered saga milestones, audit intent/completion, notification idempotency identity, failure-safe retry state, timestamps, and final result without storing a plaintext token or password. Its unresolved mandatory-cleanup state blocks login.
- **Full Account Recovery Operation**: The durable record for the separate lower-assurance recovery path. It contains an eligible account reference, HMAC digests and one-time lifecycle for confirmation, completion, and cancellation proofs, confirmation and 24-hour hold timestamps, pending/cancelled/completing/completed state, cleanup milestones, idempotent notification identities, and durable audit references without storing plaintext proofs or passwords.
- **TOTP Enrollment**: The protected account-specific second-factor secret and enrollment lifecycle, enabled only after valid initial proof.
- **Backup Code**: One member of a generated recovery set, stored as a secure representation with generation-set and one-time consumption state.
- **Pre-Authentication Challenge**: A restricted, short-lived proof state created after correct password validation for a 2FA-enabled account; cannot authorize ordinary account access.
- **UserAccount**: The SmartHire domain user, including normalized email and Pending Verification, Active, Suspended, or Deleted state.
- **AuthProviderAccount**: The Better Auth credential/provider account linked to a UserAccount; only credentials are enabled in this scope.
- **Session**: The Better Auth-authoritative opaque PostgreSQL-backed browser session, extended only for SmartHire idle/absolute/account-state policy and non-sensitive device context.
- **AuthenticationChallenge**: Temporary pre-authentication or security-challenge state that cannot authorize protected resources and is not a full Session.
- **Rate-Limit Record**: Time-bounded attempt information keyed by the minimum necessary combination of action, account/email reference, IP/network context, and challenge, used to enforce abuse controls without disclosing account existence.
- **Audit Event**: An immutable security-relevant record containing actor/reference, action, target/reference, result, timestamp, and minimized non-sensitive context.
- **Email Delivery Job**: An idempotent asynchronous request to the Transactional Email Service for verification, recovery, or security notification. It records due time, `PENDING`, `RETRYABLE`, `SENT`, or `DEAD` state, attempt count, next-attempt time, idempotency identity, safe error code, and provider message reference where available, without storing provider credentials or unnecessary secret content. Its lifecycle is independent of successful completion of the originating HTTP request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of first-time test participants can complete valid registration and reach the check-email page within 2 minutes without assistance.
- **SC-002**: Across automated tests for normalized duplicate emails and concurrent submissions, zero duplicate accounts or base Candidate identities are created.
- **SC-003**: In all account-enumeration tests covering registration, login, verification resend, and password-reset request, existing and nonexistent accounts receive the same public message class and no account-existence indicator is exposed.
- **SC-004**: In expiry, replay, and concurrency tests, 100% of verification tokens, reset tokens, pre-authentication challenges, and backup codes succeed no more than once and fail after their specified expiry or consumption.
- **SC-005**: In 100% of tested 2FA-enabled logins, ordinary authenticated resources remain inaccessible until a valid TOTP or unused backup code completes the challenge.
- **SC-006**: Within 5 seconds of a successful password reset, logout, or explicit session revocation under normal test conditions, every targeted prior session is rejected on its next request.
- **SC-007**: Source, client-bundle, database, audit, and security-log inspection across all acceptance scenarios finds zero passwords, email-provider credentials, complete verification/reset tokens, TOTP secrets/codes, backup codes, JWTs, or raw session identifiers outside their explicitly approved protected stores.
- **SC-008**: Under documented normal conditions, at least 95% of visits make each required page usable within 3 seconds, excluding separately reported Transactional Email Service delivery time.
- **SC-009**: All primary flows can be completed at a 320 CSS-pixel viewport and using keyboard-only navigation with no inaccessible controls, missing labels, focus loss, color-only state, or unintended horizontal page scrolling.
- **SC-010**: In simulated email-service and database-write failures, 100% of tested critical operations either complete consistently or fail without partial authorization, duplicate critical records, false success messages, or corruption of existing account state.
- **SC-011**: Audit verification finds every required successful and failed security event with actor/reference, action, target/reference, result, timestamp, and allowed context, with no required field missing and no prohibited secret present.
- **SC-012**: At least 90% of usability-test participants can locate current-session logout, identify the current session, revoke another session, and locate 2FA management without assistance.
- **SC-013**: Password-policy tests accept compliant Unicode and space-containing passwords without composition requirements and reject 100% of test passwords present in the approved common/compromised-password test corpus without transmitting or logging a complete password or reusable password hash.
- **SC-014**: Session-boundary tests reject 100% of sessions after 30 minutes of inactivity or 7 days of absolute age and maintain no more than five active sessions per account, revoking the least recently active session when a sixth is created.
- **SC-015**: In 100% of registration, verification-resend, and password-reset request tests, the response completes after the required transaction and Email Delivery Job commit without waiting for capture, SMTP, Resend, timeout, or provider-failure completion.
- **SC-016**: In concurrent-worker and retry tests, each logical Email Delivery Job is delivered successfully at most once, every claim increments attempts exactly once, and every completed attempt produces the expected `SENT`, `RETRYABLE`, or `DEAD` state with no duplicate terminal-failure audit event.

- **SC-017**: Component and browser tests find all required public cross-links and protected Dashboard/Profile/Overview/Security/Sessions/Sign-out actions, expose correct active state, and complete keyboard navigation at desktop and 320 CSS-pixel widths with zero horizontal overflow.
- **SC-018**: In 100% of tested direct and back-button visits after logout or without a valid ACTIVE Better Auth session, `/` renders the public SmartHire Home, `/home` redirects server-side to `/`, and `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions` redirect safely to Login without rendering protected workspace content; `/settings/security` and `/settings/sessions` redirect only to their protected Profile destinations.
- **SC-019**: Component and browser tests prove /profile, /profile/security, and /profile/sessions are directly addressable, expose correct active state, support Back/Forward, and receive the exact legacy redirects with no protected-content flash at desktop and 320 CSS pixels.
- **SC-020**: In tested enrollment and disablement flows, every Better Auth replacement session cookie reaches the browser and the immediately following protected Profile request succeeds using the same exclusive session mechanism.
- **SC-021**: In tested accounts with 2FA enabled, opening or revisiting Profile Security performs zero enrollment-start requests and does not replace the stored TOTP secret; disabled accounts receive one local QR/manual setup response only after valid renewed proof.
- **SC-022**: Automated component and browser accessibility checks find every password visibility toggle by a descriptive accessible name, confirm eye/eye-off state changes, and complete keyboard operation without replacing visible labels or autocomplete metadata.
- **SC-023**: In 100% of normal password-reset tests, Better Auth records the new password while the pre-reset TOTP state and every unused backup code remain valid; all sessions and authentication challenges are revoked, the reset notification is enqueued once, and the next successful login still requires the existing second factor.
- **SC-024**: In 100% of injected normal-reset failures and concurrent submissions, exactly one durable operation owns the token claim; retries resume its first incomplete milestone, any ambiguous Better Auth retry converges on the same submitted password without altering 2FA, no mandatory cleanup or idempotent audit/notification effect is skipped or duplicated, and login remains blocked until finalization.
- **SC-025**: In 100% of full-recovery tests, the request is enumeration-safe, one verified-email proof starts exactly one 24-hour hold, sessions/challenges are revoked, pending login is blocked, cancellation proof is single-use, completion after the hold changes the password and disables old 2FA only then, notification/audit records exist, and no automatic login occurs.

## Assumptions

- The active Spec Kit project root is `src`, so the requested relative path resolves to `src/specs/001-identity-authentication-account-recovery/spec.md` in this repository.
- Next.js App Router Route Handlers and the exclusive Better Auth opaque PostgreSQL-backed session are the confirmed architecture. Pages Router API Routes, Python/FastAPI, custom browser JWTs, and any second browser-session mechanism are excluded.
- Email/password is the only primary authentication method in this group. Google OAuth/social login, SMS OTP, phone authentication, passkeys/WebAuthn, and trusted-device behavior are excluded.
- Email OTP MUST NOT be offered as a login factor, alternative second factor, or account-recovery factor in this functional group.
- â€œGoogle Authenticatorâ€ means only an RFC 6238-compatible TOTP authenticator application and does not imply Google identity or OAuth.
- Verification and password-reset links are delivered by an approved Transactional Email Service; email delivery time is external to completion of the originating web request.
- The generated local environment selects `capture`. Individual developers may opt into Gmail-compatible SMTP for local demonstrations using a complete account address and Google App Password. Resend remains the approved production-oriented adapter, while production deployment is not part of this academic feature.
- Rate-limit thresholds, pre-authentication challenge lifetime, recent-authentication interval, session idle/absolute lifetimes, TOTP skew tolerance, backup-code count/format, and audit/operational retention periods are security policy parameters to be selected and justified during planning, without weakening the fixed behavior in this specification.
- Full account recovery is the separately controlled path for users who lose the password, TOTP access, and backup codes. Ordinary 2FA disablement still requires recent authentication, current-password proof, and a valid TOTP code. Email-only recovery is explicitly lower assurance.
- Session location is approximate and displayed only if derived lawfully and without exposing a complete IP address; absence of location data does not block session management.
- The account email field is the login identifier. Changing an email address and broader profile editing are outside this group.
- Company membership, employer verification, recruiter/administrator authority, recruitment authorization beyond base Candidate identity, and AI functionality are outside this group.

## Dependencies

- A trusted public SmartHire application URL and HTTPS-enabled production deployment configuration.
- Approved capture, optional local SMTP, and production-oriented Resend adapters behind one provider-independent service boundary, plus an asynchronous due-outbox processor with idempotent claiming, retry, terminal-failure audit, and operational failure visibility.
- A single relational database capable of enforcing uniqueness, referential integrity, transactions, authoritative session state, and atomic one-time credential consumption.
- Secure production key/secret management suitable for password hashing configuration, Better Auth/CSRF secrets, token digests, and required protection of TOTP secrets at rest.
- Reliable server time synchronization for expiry and RFC 6238 verification.

## Out of Scope

- Candidate profiles, job search, job recommendations, recruiter dashboards, job posting, applications, notifications, administration, and business analytics are excluded from the foundational identity Dashboard.
- Production deployment and operation of Resend or any SMTP relay; this specification defines production-oriented adapter behavior but does not add deployment scope.
- Google OAuth, â€œSign in with Google,â€ or any social login.
- SMS OTP, phone-number authentication, passkeys, or WebAuthn.
- Company membership, employer verification, recruiter authorization, administrator account management, or recruitment permissions beyond base Candidate identity.
- AI functionality.
- User-profile editing beyond the minimum name and email held for the account.
- Trusted-device or â€œremember this deviceâ€ behavior.
- Automatic support bypass of TOTP; any approved recovery procedure requires separate definition and authorization controls.
