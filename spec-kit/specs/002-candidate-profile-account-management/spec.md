# Feature Specification: Candidate Profile and Account Management

**Feature Branch**: `Candidate_profile_management`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Build candidate profile and account management for authenticated SmartHire users, including professional profile data, account identity and verified email changes, persisted preferences, and secure password changes while reusing UC-AUTH-07."

## Clarifications

### Session 2026-07-31

- Q: How should users add skills? → A: Use a hybrid catalog that suggests existing skills and permits normalized new entries with case-insensitive duplicate detection.
- Q: How should ongoing experience/education and future dates be represented? → A: Use explicit current-status flags; starts cannot be future, current experience has no end date, and current education may have a future expected completion date.
- Q: Should Feature 002 define a “complete profile” state or block later workflows? → A: No; all top-level profile fields remain optional, and later workflows define their own eligibility requirements.
- Q: Which resource and save boundary should the feature expose? → A: Use separate Profile, Account Identity, and Preferences resources; keep nested lists in the Profile aggregate, use dedicated email/password actions, and save explicitly per section.
- Q: What password-reuse rule should the change-password action add? → A: The new password must differ from the current password; no older password history is retained.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain a Professional Profile (Priority: P1)

As an authenticated SmartHire user, I can view and maintain my own structured
professional profile so that my current skills, experience, education, contact
details, and professional links are available to later candidate workflows.

**Why this priority**: A trustworthy candidate profile is a P0 SmartHire
capability and is the shared structured source required by later CV parsing,
candidate search, and application workflows.

**Independent Test**: Sign in as a candidate with no completed profile, verify
the empty state, add every supported type of profile information, reload the
profile, and verify that the saved structured information is shown only to that
candidate.

**Acceptance Scenarios**:

1. **Given** an authenticated user whose professional profile has no completed
   fields, **When** the user opens the profile, **Then** the page shows a clear
   "not filled yet" state and an action to begin editing rather than an error or
   blank page.
2. **Given** an authenticated user editing their own profile, **When** they
   submit valid headline, summary, phone, location, skills, experience,
   education, and social links, **Then** the complete update is saved and a
   keyboard- and screen-reader-accessible success message is shown.
3. **Given** profile text containing executable markup or script content,
   **When** the user submits it, **Then** dangerous content cannot be stored or
   executed, legitimate plain text remains usable, and the user receives clear
   validation or normalization feedback.
4. **Given** a request that attempts to name another user's account or profile,
   **When** the request reaches any profile read or write operation, **Then**
   the other user's data is neither returned nor changed.
5. **Given** two sessions that loaded the same profile revision, **When** one
   session saves and the other later saves its stale version, **Then** the later
   accepted update becomes the current version and that session receives a
   visible conflict notification explaining that another session changed the
   profile.
6. **Given** experience, education, or skills saved on a profile, **When** the
   profile is loaded again, **Then** each entry retains its independent
   structure and relationship to that profile rather than being flattened into
   an unsearchable text block.

---

### User Story 2 - Maintain Account Identity and Change Email (Priority: P1)

As an authenticated user, I can view and update my account identity while an
email-address change takes effect only after I prove control of the new address.

**Why this priority**: Accurate identity information is required throughout
SmartHire, while a verified and unique email address protects login and account
recovery.

**Independent Test**: Change a user's full name, request an email change, verify
that the old email remains the login identifier before confirmation, consume
the valid verification link sent to the new address, and verify that only the
new email works afterward.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they view account information,
   **Then** they see their full name, current email, and applicable read-only
   account metadata without any candidate professional fields being mixed into
   the identity form.
2. **Given** a valid new full name, **When** the user saves it, **Then** the
   account identity is updated and accessible success feedback is shown.
3. **Given** an unused valid new email, **When** the user passes the existing
   sensitive-action authentication policy and requests the change, **Then** a
   time-limited, single-use verification link is sent to the new email, a
   security notification is queued to the old email, and the old email remains
   the valid login identifier.
4. **Given** a pending email change, **When** its latest unexpired verification
   link is consumed, **Then** the new email becomes the account email
   atomically, the old email ceases to be a login identifier, and the link
   cannot be reused.
5. **Given** a requested email that belongs to another account or is reserved
   by another active email-change request, **When** the request is submitted,
   **Then** it is rejected without changing the current email.
6. **Given** an expired, superseded, malformed, or already-consumed email-change
   link, **When** it is opened, **Then** no identity information changes and the
   user receives a safe explanation and a way to initiate a fresh request.
7. **Given** two accounts race to claim the same previously unused email,
   **When** their requests or confirmations are processed, **Then** at most one
   account can make that email effective and the other keeps its prior email.

---

### User Story 3 - Change Password Securely (Priority: P1)

As an authenticated user who knows my current password, I can choose a stronger
password without being signed out of the session I am currently using, while
all my other sessions are revoked.

**Why this priority**: Password changes are a high-impact account security
operation and must not weaken the single authenticated-session mechanism
already provided by UC-AUTH-07.

**Independent Test**: Sign in to the same account in two sessions, change the
password from one session using valid inputs, verify that session remains
active, verify the other session is rejected, verify old credentials no longer
work, and verify that a confirmation email and safe audit event are produced.

**Acceptance Scenarios**:

1. **Given** an authenticated user who submits the correct current password and
   matching new password values of 12 to 128 characters that satisfy the
   existing password policy, **When** the change succeeds, **Then** the new
   password is effective, every other session is revoked, the initiating
   session remains active, and accessible confirmation is shown.
2. **Given** an incorrect current password, **When** the user submits the
   change, **Then** the password is unchanged, the failed check counts toward
   the protected attempt window, and no password value is logged.
3. **Given** five incorrect current-password checks for one account within 15
   minutes across one or more sessions, **When** another password-change attempt
   occurs during the lock period, **Then** it is rejected until the 15-minute
   lock expires and the user is told when they may safely try again.
4. **Given** a proposed password that is shorter than 12 characters, longer
   than 128 characters, equal to the current password, common or compromised,
   or mismatched with its confirmation, **When** the form is submitted,
   **Then** server-side validation rejects it without changing the password or
   counting it as a failed current-password check.
5. **Given** a successful password change, **When** the operation completes,
   **Then** a confirmation email is queued to the currently registered email
   and the security event records its outcome, timestamp, and protected network
   source without recording credentials or session secrets.

---

### User Story 4 - Use Consistent Account Preferences (Priority: P2)

As an authenticated user, I can choose my language, timezone, and permitted
email-notification settings once and receive the same choices on every device.

**Why this priority**: Cross-device preferences improve usability and
communication control, but the core profile, identity, and password workflows
remain usable before preferences are customized.

**Independent Test**: Open preferences for a user who has never saved them,
verify the defaults, change each user-controllable preference on one device,
sign in on another device, and verify that the same values are returned while
account-security notifications remain enabled.

**Acceptance Scenarios**:

1. **Given** a user with no stored preferences, **When** they first view the
   preference page, **Then** they receive language `vi`, timezone
   `Asia/Ho_Chi_Minh`, and enabled application-update, job-recommendation, and
   account-security email notifications.
2. **Given** a user selects valid language, timezone, and notification values,
   **When** they save and later sign in from another device, **Then** the saved
   values are shown consistently in both sessions.
3. **Given** a client attempts to disable account-security notifications,
   **When** the mutation is validated, **Then** it is rejected, the setting
   remains enabled, and the reason is communicated accessibly.
4. **Given** an unsupported language, invalid timezone, non-boolean
   notification value, or unknown notification category, **When** it is
   submitted, **Then** the server rejects the invalid preference set and
   preserves the last valid settings.

### Edge Cases

- The authenticated session expires or the account becomes ineligible while a
  form is open; no mutation is accepted, and the user is directed through the
  existing authentication flow without exposing account data.
- A profile update contains only whitespace, repeated skills with different
  capitalization, repeated social links, an invalid phone number, an unsafe URL
  scheme, a future start date, an end date earlier than its start date, or a
  current-status value that contradicts its end date.
- Sanitization removes all meaningful content from an otherwise optional field;
  the field is treated as empty and the user is informed rather than receiving
  a server error.
- One session deletes or reorders structured profile entries while another
  session saves an older list; the final accepted update wins and produces the
  required conflict notice.
- A profile update fails partway through persistence; the prior complete
  profile remains authoritative and no orphan experience, education, skill
  association, or social-link data is left behind.
- The proposed email becomes unavailable after a verification message is sent
  but before its link is consumed; verification fails safely and the current
  email remains unchanged.
- A user requests a second email change while another is pending; only the
  newest request remains usable and earlier links cannot change the account.
- Verification or notification email delivery is delayed or fails; committed
  account state remains consistent, delivery follows the existing reliable
  email process, and the user can safely request a new verification message
  where applicable.
- An email-change link is opened while signed in to a different account; the
  link can affect only the account bound to the original request and never the
  currently displayed account by inference.
- Failed current-password checks are made concurrently from several sessions;
  all attempts contribute to the same account-level limit.
- Other-session revocation cannot be completed during a password change; the
  operation does not report a completed success while those sessions remain
  usable.
- The user has a pending email change when changing the password; the password
  confirmation goes to the currently effective registered email, not the
  unverified pending address.
- A timezone identifier that was previously valid is no longer supported; the
  stored value remains visible until the user chooses another valid timezone,
  and an unrelated preference is not silently discarded.
- A cross-site request, a request with a missing or invalid anti-forgery proof,
  or a request carrying a client-supplied user identifier attempts any
  mutation; the request is rejected before data changes.
- Vietnamese names and professional text containing diacritics are preserved
  through validation and sanitization.

## Requirements *(mandatory)*

### Functional Requirements

#### Shared Access, Separation, and Feedback

- **FR-001**: The feature MUST reuse the existing UC-AUTH-07 protected-route,
  session validation, account-state, and authorization mechanisms and MUST NOT
  introduce another browser credential or authorization mechanism.
- **FR-002**: Every read and mutation MUST identify the acting account only from
  the authenticated server-side session; a client-supplied user, account, or
  profile identifier MUST NOT grant or redirect access.
- **FR-003**: Every profile, experience, education, skill-association,
  social-link, identity, preference, email-change, and password-change
  operation MUST enforce ownership before returning or changing data.
- **FR-004**: Candidate professional data, account identity, account
  preferences, authentication credentials/actions, and security audit records
  MUST remain separate responsibilities with explicit relationships and no
  duplicated source of truth. The external contract MUST expose separate
  Profile, Account Identity, and Account Preferences resources; email change
  and password change MUST be dedicated security actions rather than fields in
  a combined settings mutation.
- **FR-005**: Every mutation MUST perform server-side authorization, input
  validation, and anti-forgery validation even when equivalent browser
  validation has already run. Each editable section MUST use an explicit Save
  action; per-field autosave is outside this feature.
- **FR-006**: Every mutation MUST provide a toast announced through an ARIA live
  region, and validation or failure states MUST also provide persistent,
  focusable field or form-level guidance; color alone MUST NOT communicate the
  result.
- **FR-007**: Forms MUST be operable by keyboard, expose programmatic labels,
  move focus appropriately after validation failure, and preserve readable
  status messages for assistive technology.

#### Candidate Profile

- **FR-008**: An authenticated user MUST be able to view their own headline,
  summary, phone, location, skills, experience entries, education entries, and
  social links.
- **FR-009**: A profile with no meaningful professional content MUST return a
  valid empty profile and display a clear "not filled yet" state with an edit
  action. Feature 002 MUST NOT calculate or enforce a profile-completeness gate.
- **FR-010**: A user MUST be able to add, edit, remove, and reorder their own
  skills, experience entries, education entries, and social links.
- **FR-011**: Experience and education MUST be independent structured child
  records related to one profile. Skills MUST be reusable structured records
  associated with profiles through a many-to-many relationship. Skill entry
  MUST suggest existing catalog records while allowing users and Feature 004 to
  create normalized new skills so the data supports later search/filtering
  without blocking unfamiliar skills.
- **FR-012**: Profile saves that affect the profile and its structured child
  data MUST treat Profile as the aggregate contract and preserve referential
  integrity as one complete outcome; a failed save MUST NOT leave a partially
  updated profile or orphaned records.
- **FR-013**: Optional headline, summary, phone, and location values MUST accept
  empty input. When present, headline MUST be at most 200 characters, summary
  at most 5,000 characters, phone at most 32 characters, and location at most
  160 characters.
- **FR-014**: A profile MUST accept at most 50 unique skills, 50 experience
  entries, 50 education entries, and 10 unique social links. Each skill MUST be
  non-empty and at most 80 characters. Skill labels MUST have surrounding
  whitespace removed and repeated internal whitespace collapsed. Matching and
  duplicate detection MUST be case-insensitive while preserving the selected
  display capitalization and Vietnamese diacritics. Each capped collection MUST
  be returned in full without pagination in Feature 002.
- **FR-015**: Each experience entry MUST contain a non-empty title, company, and
  valid non-future start date, plus an explicit current-status value. Its
  description MAY be empty. A current experience MUST have no end date; a
  non-current experience MUST have a non-future end date that does not precede
  its start date. Title and company MUST each be at most 200 characters and
  description at most 3,000 characters.
- **FR-016**: Each education entry MUST contain a non-empty institution, degree,
  valid non-future start date, plus an explicit current-status value. Its field
  MAY be empty. A non-current education entry MUST have a non-future end date;
  a current education entry MAY omit its end date or provide a future expected
  completion date. Any provided end date MUST NOT precede its start date.
  Institution, degree, and field MUST each be at most 200 characters.
- **FR-017**: A provided phone value MUST be NFKC-normalized, trimmed, contain
  7 to 15 ASCII digits after presentation characters are removed, and be at
  most 32 characters. It MUST match
  `^(?=(?:[^0-9]*[0-9]){7,15}[^0-9]*$)\+?(?:[0-9]{1,4}|\([0-9]{1,4}\))(?:[ .-]?(?:[0-9]{1,4}|\([0-9]{1,4}\)))*$`:
  the leading lookahead enforces the total ASCII-digit count, followed by one
  optional leading `+`; digit groups of one to four digits; and only a single
  space, hyphen, period, or balanced parentheses as presentation characters.
  Extensions, letters, slashes, repeated separators, unbalanced parentheses,
  a `+` anywhere except the start, fewer than 7 digits, and more than 15 digits
  MUST be rejected. Accepted examples are `0912345678`, `0912 345 678`,
  `+84 912 345 678`, `(028) 3822-1234`, and `+1 (415) 555-2671`. Rejected
  examples are `+84`, `0912--345-678`, `+84 912 345 678 ext 9`,
  `0912/345/678`, and `+84 (912 345-678`. The validated display value is
  profile contact data only; Feature 002 MUST NOT use it for SMS,
  verification, or authentication.
- **FR-018**: Each social link MUST be a complete `http` or `https` URL of at
  most 2,048 characters, MUST NOT contain embedded credentials, and MUST reject
  executable or non-web schemes.
- **FR-019**: All free-text profile values, including nested entry values and
  skill labels, MUST be normalized and sanitized against stored cross-site
  scripting before persistence and MUST remain inert when displayed.
- **FR-020**: Every returned profile MUST carry a modification revision. If an
  update is based on an older revision, the server MUST still apply the valid
  later submission under last-write-wins, return an explicit conflict result,
  and the interface MUST notify the submitting user that concurrent changes
  were overwritten.

#### Account Identity and Email Change

- **FR-021**: Account identity MUST expose the user's full name and currently
  effective email separately from candidate professional fields. Existing
  account-created and verification/status metadata MAY be shown read-only.
- **FR-022**: The user MUST be able to update a full name containing 1 to 150
  non-whitespace characters after normalization; the value MUST be sanitized
  before persistence.
- **FR-023**: Email values MUST be normalized for comparison, meet valid email
  syntax and length rules, and be unique across effective account emails and
  active pending email-change reservations.
- **FR-024**: Requesting an email change MUST satisfy the existing
  sensitive-action reauthentication policy before a pending request is
  created.
- **FR-025**: A valid email-change request MUST atomically reserve the proposed
  email, create a single-use verification link that expires after 30 minutes,
  queue that link to the new email, and queue a security notification to the
  old email before reporting the request as accepted.
- **FR-026**: A pending email change MUST NOT alter the current account email or
  login identifier before verification. The unverified new email MUST NOT be
  accepted for login or account recovery.
- **FR-027**: Creating a newer email-change request for the same account MUST
  supersede every earlier unconsumed request for that account.
- **FR-028**: Consuming the latest valid link MUST atomically recheck
  uniqueness, make the new email effective, release the old email, consume the
  link, and ensure the old email is no longer accepted for future login.
- **FR-029**: An expired, malformed, superseded, already-consumed, or
  no-longer-unique email-change proof MUST NOT change identity data and MUST NOT
  disclose tokens or unrelated account details.
- **FR-030**: Verification links, their secret values, and complete
  secret-bearing URLs MUST never be written to application or security logs.

#### Account Preferences

- **FR-031**: The user MUST be able to view and update language, timezone, and
  email-notification settings independently of profile and identity data.
- **FR-032**: Language MUST accept only `vi` or `en`, and timezone MUST be a
  currently valid IANA timezone identifier.
- **FR-033**: Email-notification settings MUST contain boolean values for
  `application_updates`, `job_recommendations`, and `account_security`;
  unsupported categories or non-boolean values MUST be rejected.
- **FR-034**: `account_security` MUST always remain enabled. The interface MUST
  show it as mandatory, and the server MUST reject an explicit attempt to set
  it to false.
- **FR-035**: A user without saved preferences MUST receive defaults of
  language `vi`, timezone `Asia/Ho_Chi_Minh`, and all three email-notification
  categories enabled.
- **FR-036**: Saved preferences MUST use authoritative persistent account
  storage and be available across browsers, devices, and authenticated
  sessions; browser-only storage MUST NOT be their source of truth.
- **FR-037**: A preference update MUST be applied as one validated set and MUST
  preserve the prior valid set if any submitted value is invalid.

#### Password Change and Security Audit

- **FR-038**: Changing a password MUST require current password, new password,
  and new-password confirmation in one protected operation.
- **FR-039**: The current password MUST be verified by the existing
  authentication owner. The new password MUST contain 12 to 128 characters,
  accept Unicode and spaces without silent truncation, differ from the current
  password, pass the existing common/compromised-password screen, and match its
  confirmation, with all checks repeated on the server. Uppercase, lowercase,
  digit, and symbol composition rules MUST NOT be added, and no history of
  older passwords MUST be retained.
- **FR-040**: Only an incorrect current password MUST increment the
  current-password failure counter; validation failures in the proposed new
  password, including reuse of the current password, MUST NOT increment it.
- **FR-041**: Five incorrect current-password checks for the same account within
  a rolling 15-minute window MUST block further password-change attempts for 15
  minutes. The limit MUST aggregate attempts across sessions and MUST be
  enforced by shared server-side state.
- **FR-042**: A successful password change MUST clear the applicable failed
  attempt state, revoke every other active session, preserve the initiating
  session as active, and avoid trusting a client-supplied session identifier to
  select that session.
- **FR-043**: A password change MUST NOT be reported as successfully completed
  while any other session that should be revoked remains usable.
- **FR-044**: Each successful password change MUST queue exactly one
  confirmation email to the currently effective registered email address
  without waiting for external delivery before returning the completed account
  state.
- **FR-045**: Accepted and rejected email-change requests, email-change
  verification outcomes, password-change outcomes, and password-change lock
  events MUST create allowlisted security audit events with actor, action,
  result, timestamp, target, and a protected source-IP representation usable
  for authorized security investigation.
- **FR-046**: Raw passwords, password confirmations, verification secrets,
  one-time values, session credentials, request bodies, and raw secret-bearing
  URLs MUST never appear in audit records, application logs, error messages, or
  analytics.
- **FR-047**: Raw source IP values MUST NOT be emitted to ordinary application
  logs. Any persisted source-IP representation MUST follow the existing
  privacy and access-control policy while retaining the security evidence
  required by FR-045.
- **FR-048**: Personal profile, identity, preference, and security-event data
  MUST be collected, displayed, retained, and disclosed only for the approved
  account and candidate purposes and under SmartHire's existing privacy,
  retention, deletion, and least-privilege policies.

### Key Entities *(include if feature involves data)*

- **Candidate Profile**: The professional record owned one-to-one by a base
  Candidate account; contains headline, summary, phone, location, social links,
  and a modification revision, and relates to structured skills, experience,
  and education.
- **Profile Experience**: An independently addressable professional-history
  entry owned through one Candidate Profile; contains title, company, start
  date, explicit current status, an end date required only for completed roles,
  and optional description.
- **Profile Education**: An independently addressable education-history entry
  owned through one Candidate Profile; contains institution, degree, optional
  field, start date, explicit current status, and an end date that may represent
  an expected future completion while study is current.
- **Skill**: A normalized reusable professional skill that can relate to many
  Candidate Profiles. Users select suggested catalog skills or create a new
  normalized label when no suitable skill exists.
- **Profile-Skill Association**: The many-to-many ownership relationship
  between Candidate Profiles and Skills; it permits future structured search
  and Feature 004 imports without flattening skills into free text.
- **Social Link**: A validated ordered web link belonging to one Candidate
  Profile.
- **Account Identity**: The authoritative identity record containing full name,
  normalized effective email, and system-managed account metadata; it is
  separate from professional profile and preferences.
- **Email Change Request**: A temporary request bound to one Account Identity
  and one proposed normalized email; tracks expiry, consumption, supersession,
  and outcome without exposing its verification secret.
- **Account Preferences**: One account's language, timezone, and three
  email-notification flags, including the immutable enabled
  `account_security` flag.
- **Password Change Attempt Window**: Shared account-level state that tracks
  incorrect current-password checks and a temporary password-change lock.
- **Password Change Operation**: An internal durable, idempotent orchestration
  record that tracks password-update, other-session-revocation, notification,
  audit, and finalization milestones. It stores no password, credential hash,
  session token, raw request body, or email address.
- **Security Audit Event**: An allowlisted record of a sensitive account action
  and its outcome, actor, target, timestamp, and privacy-protected network
  source; it contains no authentication secrets.
- **Authentication Session**: The existing UC-AUTH-07 session record. This
  feature references it for authorization and other-session revocation but
  does not redefine or duplicate it.

### Verification Requirements

- **VR-001**: Automated authorization tests MUST use at least two accounts and
  prove that one cannot read or mutate the other's profile, nested profile
  records, identity, preferences, pending email change, password, or session
  state, including requests carrying forged ownership identifiers.
- **VR-002**: Automated server-validation tests MUST cover field and list
  limits, empty required nested values, invalid date ranges, unsafe profile
  content, unsafe URLs, duplicate skills/links, invalid identity values,
  duplicate emails, invalid preference values, missing anti-forgery proof,
  short passwords, and mismatched confirmation.
- **VR-003**: The full password-change test MUST cover incorrect-current-
  password counting, the fifth-failure lock, lock expiry, successful credential
  replacement, current-password reuse rejection, 12- and 128-character
  boundaries, common/compromised-password rejection, absence of composition
  rules and password-history storage, old-password rejection, other-session
  revocation, initiating-session continuity, confirmation-email queuing, audit
  redaction, and accessible user feedback.
- **VR-004**: The full email-change test MUST cover reauthentication, new-email
  verification delivery, old-email security notification, old-email login
  before verification, valid confirmation, new-email login afterward,
  old-email rejection afterward, duplicate and concurrent claims, expired and
  superseded links, single use, audit redaction, and delivery failure handling.
- **VR-005**: Automated tests MUST prove that an empty profile and absent
  preferences return their defined states, saved preferences persist across
  sessions, account-security email cannot be disabled, stored text cannot
  execute as markup, structured profile relations retain integrity, and stale
  profile saves always produce a visible conflict result.
- **VR-006**: Accessibility checks MUST cover keyboard operation, focus after
  errors, labels, ARIA live announcements for toasts, persistent error
  summaries, sufficient contrast, responsive mobile use, and non-color status
  cues for all four user stories.

### Scope Boundaries

- This feature includes only self-service access to the authenticated user's
  professional profile, account identity, account preferences, email-change
  workflow, and password-change workflow.
- CV upload, CV parsing, parsed-data review or confirmation, and any other
  Feature 004 user experience are excluded. Feature 004 may later write to the
  same approved structured profile entities.
- Recruitment preferences beyond the three named email-notification categories,
  candidate recommendations, public or recruiter profile viewing, avatar or
  document management, and new demographic or legal identity fields are
  excluded.
- Profile-completeness scoring and job-application eligibility gates are
  excluded. Each later workflow MUST define its own minimum profile data rather
  than treating a Feature 002 field as implicitly mandatory.
- Registration, login, account recovery, two-factor authentication, general
  session management, and protected-route authorization remain owned by
  UC-AUTH-07. This feature only consumes those capabilities and invokes
  other-session revocation after a password change.
- Account deletion, suspension, reinstatement, and administrator editing are
  excluded and continue to follow their existing or future feature ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Under the documented normal test environment and maximum supported
  Profile dataset, the p95 elapsed time from authenticated navigation start
  until a visible loading, empty, or completed profile/account-management state
  MUST be at most 3 seconds over at least 100 warm samples per measured view
  class.
- **SC-002**: Under the documented normal test environment, the p95 elapsed time
  from a valid profile, identity, or preference submission until authoritative
  data and an accessible visible result are shown MUST be at most 2 seconds over
  at least 100 warm samples per measured mutation class, excluding asynchronous
  provider delivery.
- **SC-003**: At least 90% of representative users can complete each primary
  profile, identity, preference, and password task on their first attempt
  without assistance in usability testing.
- **SC-004**: In the authorization test suite, 100% of attempted cross-account
  reads and writes are denied without exposing or changing the target account's
  data.
- **SC-005**: In concurrency tests, 100% of valid stale profile submissions
  follow last-write-wins and show the submitting user a conflict notification;
  none silently overwrite another session.
- **SC-006**: In password-change tests, 100% of successful changes leave the
  initiating session usable, make all other sessions unusable within 2 seconds,
  reject the former password, and queue exactly one confirmation notification.
- **SC-007**: In email-change flow tests, 100% of valid pending changes preserve
  old-email login before verification, make only the verified new email
  effective afterward, and prevent reuse of the verification link.
- **SC-008**: Preference choices saved in one session are returned unchanged in
  100% of cross-device and later-session tests, while account-security
  notifications remain enabled.
- **SC-009**: Automated security tests execute stored profile and identity
  values in supported browsers with zero successful script, markup, unsafe URL,
  or event-handler execution.
- **SC-010**: All profile and account-management tasks can be completed at a
  320-pixel viewport and using only a keyboard, with every success and error
  result available to a screen reader.

## Assumptions

- Every normal SmartHire account already has the base Candidate identity and
  uses the UC-AUTH-07 server-controlled session and protected workspace.
- Feature 001's statement that email change was outside its identity-delivery
  scope does not prohibit later work; this feature intentionally owns email
  change while reusing Feature 001's authentication, verification, audit, and
  reliable-email foundations.
- Only full name and email are newly user-editable account identity fields in
  this feature. "Other identity fields" refers to existing system-managed
  metadata such as account creation and verification/status information, which
  may be displayed read-only; adding date of birth, avatar, legal identifiers,
  or demographic fields is not implied.
- The existing sensitive-action policy requires renewed proof when the current
  session is older than its approved freshness threshold; this feature reuses
  that policy for email changes rather than defining a second mechanism.
- A pending email-change link expires after 30 minutes, and only the newest
  request for an account remains valid. These values can be revisited during
  planning only if the existing identity policy already defines a stricter
  compatible value.
- Default preferences are `vi`, `Asia/Ho_Chi_Minh`, and all email categories
  enabled because SmartHire primarily serves Vietnamese organizations and
  security notices are mandatory.
- Security audit handling records a protected representation of the request
  source IP that is usable under authorized investigation without placing raw
  IPs in ordinary logs, consistent with the existing privacy baseline.
- Verification and confirmation emails use the existing reliable transactional
  email process. External provider delivery may be asynchronous and does not
  become a transaction boundary for committed account data.
- Profile structured entities are the shared target for later Feature 004 CV
  parsing, but CV upload, parsing, mapping review, and confirmation are outside
  this feature.
- Recruitment-related preference fields beyond the three specified
  notification categories are out of scope.

## Feature 016 Notification Integration

- Completed password, recovery, old-address email-change alert, account-state, session-revocation, and membership-state events also create a safe in-app notification in the authoritative transaction.
- Verification links, reset links, company-email proofs, and other challenge-bearing emails remain email-only and never persist their token or proof in the inbox.
- Existing email recipients, preferences, templates, retry behavior, and mandatory security-email rules are unchanged.
