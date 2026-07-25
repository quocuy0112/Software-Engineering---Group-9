# SmartHire Desktop-Web Prototype Implementation Plan

Source of truth: docs/analysis-and-design/use_cases/specification/01_Identity_Access_Profile.md

Planning assumptions:

- Desktop web, English, light theme.
- Canonical frame width is 1440 px. The existing authentication frames are 1440 x 1024, so 1024 px is the provisional frame height until a height is approved.
- UC-ACC-02 is Manage Account Preferences.
- The source heading Alter8native Flows is interpreted as Alternative Flows.
- A canonical screen is a route/task-level full-screen layout. Inline validation, alerts, toasts, loading, modals, cooldowns, and content-only result changes are states of a canonical screen or component, not additional canonical screens.
- Existing Reqwise Tokens and existing authentication components are reused before any new asset is created.
- This phase is read-only for Figma.

## 1. Use-case inventory

### UC-AUTH-01 - Register Account

- Basic Flow 1-13: enter registration from Create account; display the form; collect full name, email, password, confirmation, and Terms acceptance; show password-policy progress; validate; check email uniqueness; create a pending account and token; send verification email; display verification pending; continue through UC-AUTH-02.
- Alternative Flows: AF-01 missing required fields -> inline field errors with valid input preserved; AF-02 invalid email -> inline email error; AF-03 password policy failure -> requirement states and cleared password fields; AF-04 confirmation mismatch -> inline mismatch error; AF-05 existing email -> neutral privacy-safe alert with check-email, sign-in, or try-another-email actions; AF-06 cancel -> leave without creating an account.
- Exception Flows: EF-01 email delivery failure -> verification-pending state with resend; EF-02 account creation failure -> retry alert on the registration screen.
- Extension/invocation: Email Verification invokes UC-AUTH-02 after the pending account is created.

### UC-AUTH-02 - Verify Email Address

- Basic Flow 1-9: open the email link; validate the token and pending account; atomically activate the account and invalidate the token; record the event; show verification success with Log in.
- Alternative Flows: AF-01 invalid token -> invalid-link result with request-new action; AF-02 expired token -> expired-link result with resend; AF-03 used token -> neutral no-longer-valid result; AF-04 already verified -> success result; AF-05 request another message -> neutral email submission and conditional resend; AF-06 resend rate-limited -> cooldown remaining.
- Exception Flows: EF-01 activation save failure -> rollback and retry result.
- Extension/invocation: reached from UC-AUTH-01 and from changed-email verification in UC-ACC-01.

### UC-AUTH-03 - Log In

- Basic Flow 1-11: display login; collect email/password; validate credentials and account status; create and record a secure session; route to retained destination or dashboard.
- Alternative Flows: AF-01 invalid credentials -> neutral inline alert; AF-02 unverified -> verification-required alert with resend; AF-03 temporarily locked -> restriction alert; AF-04 suspended/disabled -> support or appeal instructions; AF-05 Forgot password -> invoke UC-AUTH-05; AF-06 existing valid session -> retained destination/dashboard; AF-07 rate limit -> retry-later state.
- Exception Flows: EF-01 authentication unavailable -> temporary-unavailability alert.
- Extension/invocation: invokes UC-AUTH-05; extends UC-AUTH-07 when a protected route has no valid session.

### UC-AUTH-04 - Log Out and End Session

- Basic Flow 1-8: open account menu; show actions; select Log out; revoke session/refresh credential; clear cookies; record logout; route to public home or login.
- Alternative Flows: AF-01 already-expired session -> clear local data and route to login.
- Exception Flows: EF-01 server revocation failure -> still clear local cookies and complete local logout.
- Extension/invocation: none. The account menu is an overlay on every authenticated screen, not a separate full screen.

### UC-AUTH-05 - Recover Password

- Basic Flow 1-15: open recovery request; submit email; show neutral response; conditionally issue and send token; open reset link; validate token; display new-password form; validate and update password; invalidate token and existing sessions; show success.
- Alternative Flows: AF-01 invalid/unregistered email -> identical neutral response; AF-02 invalid/expired/used token -> invalid-link result with new-request action; AF-03 policy failure -> password requirements; AF-04 mismatch -> inline error; AF-05 same as current password -> choose-different error.
- Exception Flows: EF-01 email delivery failure -> retain neutral public response; EF-02 password update failure -> retry alert with old password preserved.
- Extension/invocation: invoked from UC-AUTH-03.

### UC-AUTH-06 - Change Password

- Basic Flow 1-10: open account security; enter current/new/confirmed passwords; verify and validate; update securely; invalidate other sessions; audit; show success.
- Alternative Flows: AF-01 wrong current password; AF-02 policy failure; AF-03 confirmation mismatch; AF-04 new equals current; AF-05 cancel; AF-06 session expired -> login. All password errors remain on the same form.
- Exception Flows: EF-01 update failure -> retry alert; current password remains unchanged.
- Extension/invocation: protected by UC-AUTH-07.

### UC-AUTH-07 - Access Protected Account Page

- Basic Flow 1-7: request a protected route; validate session, account, and authorization; display the requested page.
- Alternative Flows: AF-01 no session -> invoke UC-AUTH-03 and retain destination; AF-02 expired session -> clear invalid data and login; AF-03 no permission -> access-denied result; AF-04 suspended -> terminate session and show support/appeal; AF-05 missing resource -> not-found result without disclosure.
- Exception Flows: EF-01 authorization unavailable -> deny by default and show temporary-error result.
- Extension/invocation: invokes UC-AUTH-03. It guards UC-AUTH-06, UC-ACC-01, UC-ACC-02, UC-PROF-01, UC-PROF-02, and UC-PROF-03.

### UC-ACC-01 - Manage Account Information

- Basic Flow 1-11: open settings; view current information; enter edit mode; update permitted fields; validate and concurrency-check; save/audit; return to updated view with success.
- Alternative Flows: AF-01 invalid data -> inline errors with preserved input; AF-02 email change -> pending email plus verification; AF-03 unavailable email -> neutral inline error; AF-04 cancel -> stored view; AF-05 concurrent update -> reload latest data and require review; AF-06 session expired -> login.
- Exception Flows: EF-01 save failure -> previous data retained with retry alert.
- Extension/invocation: changed-email verification invokes UC-AUTH-02.

### UC-ACC-02 - Manage Account Preferences

- Basic Flow 1-8: open preferences; display stored values; edit; save; validate; persist/apply; show success.
- Alternative Flows: AF-01 unsupported value -> identify and restore nearest valid choice; AF-02 restore defaults -> preview and confirmation modal, then save; AF-03 cancel -> stored values; AF-04 concurrent update -> reload/reapply; AF-05 session expired -> login.
- Exception Flows: EF-01 save failure -> previous values remain with retry alert.
- Extension/invocation: protected by UC-AUTH-07.

### UC-PROF-01 - Manage Candidate Profile

- Basic Flow 1-11: open profile; show profile and completion; edit supported sections; validate and concurrency-check; save; recalculate completion; return to updated profile with success.
- Alternative Flows: AF-01 first profile -> empty create mode; AF-02 missing required data -> section/field errors; AF-03 invalid experience/education dates -> date-range errors; AF-04 Upload CV -> invoke UC-PROF-02; AF-05 cancel -> stored profile; AF-06 concurrent modification -> latest version and re-review; AF-07 session expired -> login.
- Exception Flows: EF-01 save failure -> old profile retained with retry alert.
- Extension/invocation: Upload CV invokes UC-PROF-02.

### UC-PROF-02 - Upload and Parse CV

- Basic Flow 1-11: open upload; show requirements; select and validate file; scan; confirm; store; parse; save result/confidence; invoke UC-PROF-03.
- Alternative Flows: AF-01 unsupported type; AF-02 oversized; AF-03 empty/corrupt/password-protected; AF-04 unsafe/quarantined; AF-05 cancel; AF-06 duplicate -> replace/cancel modal; AF-07 low confidence -> mark fields for review. File failures stay on the upload screen.
- Exception Flows: EF-01 parser unavailable -> retry and manual-entry options; EF-02 upload/storage failure -> retry.
- Extension/invocation: successful parsing invokes UC-PROF-03.

### UC-PROF-03 - Review and Confirm Parsed CV

- Basic Flow 1-12: display parsed data and low-confidence markers; review/correct; choose merge behavior; confirm; validate/concurrency-check; atomically update profile and confirm result; recalculate completion; show updated profile.
- Alternative Flows: AF-01 missing required data -> inline errors; AF-02 remove bad entry; AF-03 keep stored value; AF-04 replace with parsed value; AF-05 discard -> confirmation modal then profile unchanged; AF-06 return later -> save unconfirmed draft; AF-07 profile changed -> reload and resolve conflicts.
- Exception Flows: EF-01 save failure -> result remains unconfirmed; old profile retained with retry.
- Extension/invocation: invoked by UC-PROF-02 and returns to the canonical candidate profile.

## 2. Canonical screen registry

| Screen ID | Canonical screen | Use cases and steps | Reusable? |
|---|---|---|---|
| S-AUTH-REGISTER | Registration form | AUTH-01 BF1-12, AF-01..06, EF-02 | No; one route with form states |
| S-AUTH-EMAIL-PENDING | Verification pending and resend | AUTH-01 BF12-13/EF-01; AUTH-02 AF-01/02/05/06; ACC-01 AF-02 entry to verification | Yes |
| S-AUTH-LINK-STATUS | Auth-link/result page | AUTH-02 BF9, AF-01..04, EF-01; AUTH-05 BF15, AF-02 | Yes; content/status variants |
| S-AUTH-LOGIN | Login form | AUTH-03 BF1-11 and AF/EF; AUTH-04 BF8/AF-01/EF-01; session-expiry branches in AUTH-06, AUTH-07, ACC-01, ACC-02, PROF-01 | Yes |
| S-AUTH-RECOVERY-REQUEST | Password-recovery email request | AUTH-03 AF-05 destination; AUTH-05 BF1-8, AF-01, EF-01 | Entry is shared; owned by AUTH-05 |
| S-AUTH-RESET-PASSWORD | New-password form | AUTH-05 BF8-14, AF-03..05, EF-02 | No; one route with form states |
| S-APP-DASHBOARD | Default protected landing | AUTH-03 BF11/AF-06; AUTH-07 BF7 when no retained route; AUTH-04 representative logout origin | Yes |
| S-SHARED-ROUTE-STATUS | Protected-route outcome | AUTH-07 AF-03..05, EF-01 | Yes as a status template; variants are not separate screens |
| S-ACC-ACCOUNT-INFO | Account information view/edit | ACC-01 BF1-11 and all AF/EF; AUTH-07 BF7 requested destination | Route reused across view/edit states |
| S-ACC-PREFERENCES | Preferences | ACC-02 BF1-8 and all AF/EF; AUTH-07 BF7 requested destination | Route reused across dirty/default/confirmation states |
| S-ACC-SECURITY | Account security/change password | AUTH-06 BF1-10 and all AF/EF; AUTH-07 BF7 requested destination | Route reused across password states |
| S-PROF-PROFILE | Candidate profile view/edit/create | PROF-01 all flows; PROF-02 EF-01 manual entry/cancel; PROF-03 BF12/AF-05/06; AUTH-07 BF7 | Yes |
| S-PROF-CV-UPLOAD | CV upload and parsing progress | PROF-01 AF-04; PROF-02 BF1-10 and AF/EF; AUTH-07 BF7 | Entry shared; owned by PROF-02 |
| S-PROF-CV-REVIEW | Parsed CV review/merge | PROF-02 BF11/AF-07; PROF-03 BF1-11 and AF/EF; AUTH-07 BF7 | Yes across invoked flow boundary |

Canonical full-screen count: 14.

Shared-screen count: 5 screens directly render substantive states in more than one use case: S-AUTH-EMAIL-PENDING, S-AUTH-LINK-STATUS, S-AUTH-LOGIN, S-APP-DASHBOARD, and S-PROF-PROFILE. Invoked-use-case entry screens and UC-AUTH-07 guard destinations are shown separately in the reuse matrix and are not inflated into the shared count.

## 3. Shared-state strategy

### State/component variants, not new full screens

- Registration: default, password-progress, validation error, existing-email neutral response, submit failure.
- Verification pending: sent, delivery issue, resend ready, cooldown/rate-limited.
- Auth-link status: verification success, invalid, expired, already used, activation retry, password-reset success, reset-link invalid/expired.
- Login: default, invalid credentials, verification required, temporary lock, suspended/disabled guidance, rate limit, service unavailable.
- Recovery request: entry and neutral request-accepted states.
- Password forms: default, policy failure, mismatch, same-as-current, wrong-current (change only), update failure, success toast.
- Protected account menu: closed/open. Logout processing is a button/loading state.
- Account information: view/edit modes; invalid fields, pending email, unavailable email, concurrent refresh, save failure, and success are inline states.
- Preferences: stored/dirty values; unsupported value correction; restore-default confirmation modal; concurrent refresh; save failure/success.
- Candidate profile: view/edit/empty-create; missing data/date errors; concurrent refresh; save failure/success.
- CV upload: idle, drag-over, selected, uploading, parsing, validation error, unsafe rejection, duplicate confirmation, parser unavailable, storage failure.
- CV review: normal/low-confidence fields, missing-field errors, remove entry, keep/replace conflict choice, discard modal, saved draft, concurrent conflict, retry.
- Route outcomes use one status-page template with access-denied, suspended, not-found, and unavailable variants.

The current Figma system contains 35 reusable component variants: five Text Input, five Password Input, ten Button, four Alert, three Password Requirement, three Checkbox, and one each for Text Link, Validation Message, Loading State, Authentication Card, and Navigation/Auth Header.

Proposed new variant families:

| New component family | Variants | Count |
|---|---|---:|
| App Header / Account Menu | default, menu open | 2 |
| Settings Navigation Item | default, hover, active | 3 |
| Toggle | off, on, disabled-off, disabled-on | 4 |
| Select | default, focused, open, selected, error, disabled | 6 |
| Radio / Merge Choice | unselected, selected, conflict, disabled | 4 |
| Confirmation Modal | standard, destructive, busy | 3 |
| Profile Section | view, edit, empty, error | 4 |
| Repeatable Profile Entry | view, edit, empty, error, conflict | 5 |
| File Upload | idle, drag-over, selected, uploading, parsing, error, duplicate | 7 |
| Confidence Field | normal, low confidence, conflict, accepted | 4 |
| Completion Indicator | empty, partial, complete | 3 |
| System Status Card | success, neutral, warning, error | 4 |
| Cooldown Action | ready, counting down, blocked | 3 |
| **Proposed new variants** |  | **52** |

Planned design-system total: 87 component/state variants (35 existing + 52 proposed). Copy changes such as invalid versus expired are properties of Status Card, not extra variants.

### Separate full screens

Only the 14 canonical routes/tasks in the screen registry require full-screen layouts. In particular, recovery request and reset-password are separate because they are different routes and tasks; CV upload and CV review are separate because they have different information architecture and user decisions; account information, preferences, and security are separate settings destinations.

### Backend-only steps represented as annotations/decision nodes

| Use case | Backend-only or decision steps; no UI screen |
|---|---|
| AUTH-01 | BF7-11 email lookup, hashing, pending-account/token creation, delivery; BF8 is never visualized as a UI state |
| AUTH-02 | BF2-8 token/account validation, atomic activation, invalidation, audit |
| AUTH-03 | BF5-10 request/account/password/status checks, session creation, audit |
| AUTH-04 | BF4-7 session lookup/revocation, cookie clearing, audit |
| AUTH-05 | BF5-7 account lookup/token/delivery; BF9 token validation; BF12-14 password update/token and session invalidation |
| AUTH-06 | BF5-9 current-password verification, validation, hashing/storage, other-session invalidation, audit |
| AUTH-07 | BF2-6 credential/session/account/authorization checks |
| ACC-01 | BF7-10 validation, optimistic-concurrency decision, persistence, audit |
| ACC-02 | BF5-7 validation, persistence, immediate application |
| PROF-01 | BF7-10 validation, concurrency decision, persistence, completion calculation |
| PROF-02 | BF4-5 server file validation/security scan; BF7-10 protected storage, parser job/result/confidence persistence |
| PROF-03 | BF7-11 validation, concurrency decision, atomic merge/confirmation, completion calculation |

Preconditions, postconditions, auditing, rate limits, non-enumeration, encryption, authorization, token properties, and atomicity appear as flow-map annotations or decision nodes. They do not become UI screens.

## 4. Reuse matrix

Legend: P = primary screen rendered by the use case; R = redirect/result screen rendered; I = entry to an invoked use case; G = possible destination guarded by UC-AUTH-07; - = not used.

Use-case columns: A1 AUTH-01, A2 AUTH-02, A3 AUTH-03, A4 AUTH-04, A5 AUTH-05, A6 AUTH-06, A7 AUTH-07, C1 ACC-01, C2 ACC-02, P1 PROF-01, P2 PROF-02, P3 PROF-03.

### Canonical screens

| Screen | A1 | A2 | A3 | A4 | A5 | A6 | A7 | C1 | C2 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S-AUTH-REGISTER | P | - | - | - | - | - | - | - | - | - | - | - |
| S-AUTH-EMAIL-PENDING | P | P | - | - | - | - | - | I | - | - | - | - |
| S-AUTH-LINK-STATUS | - | P | - | - | P | - | - | - | - | - | - | - |
| S-AUTH-LOGIN | - | - | P | R | - | R | P | R | R | R | - | - |
| S-AUTH-RECOVERY-REQUEST | - | - | I | - | P | - | - | - | - | - | - | - |
| S-AUTH-RESET-PASSWORD | - | - | - | - | P | - | - | - | - | - | - | - |
| S-APP-DASHBOARD | - | - | R | P | - | - | P | - | - | - | - | - |
| S-SHARED-ROUTE-STATUS | - | - | - | - | - | - | P | - | - | - | - | - |
| S-ACC-ACCOUNT-INFO | - | - | - | - | - | - | G | P | - | - | - | - |
| S-ACC-PREFERENCES | - | - | - | - | - | - | G | - | P | - | - | - |
| S-ACC-SECURITY | - | - | - | - | - | P | G | - | - | - | - | - |
| S-PROF-PROFILE | - | - | - | - | - | - | G | - | - | P | R | R |
| S-PROF-CV-UPLOAD | - | - | - | - | - | - | G | - | - | I | P | - |
| S-PROF-CV-REVIEW | - | - | - | - | - | - | G | - | - | - | I | P |

### Component families

| Component family | A1 | A2 | A3 | A4 | A5 | A6 | A7 | C1 | C2 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth Header + Authentication Card | X | X | X | - | X | - | - | - | - | - | - | - |
| Text Input | X | X | X | - | X | - | - | X | - | X | - | X |
| Password Input + Requirements | X | - | X | - | X | X | - | - | - | - | - | - |
| Buttons + Loading | X | X | X | X | X | X | X | X | X | X | X | X |
| Alert / Validation | X | X | X | - | X | X | X | X | X | X | X | X |
| App Header / Account Menu | - | - | - | X | - | X | X | X | X | X | X | X |
| Settings Navigation Item | - | - | - | - | - | X | - | X | X | - | - | - |
| Toggle / Select | - | - | - | - | - | - | - | X | X | X | - | X |
| Confirmation Modal | - | - | - | - | - | - | - | - | X | - | X | X |
| Profile Section / Entry | - | - | - | - | - | - | - | - | - | X | - | X |
| File Upload | - | - | - | - | - | - | - | - | - | - | X | - |
| Confidence Field / Merge Choice | - | - | - | - | - | - | - | - | - | - | X | X |
| Completion Indicator | - | - | - | - | - | - | - | - | - | X | - | X |
| System Status Card | - | X | - | - | X | - | X | - | - | - | - | - |
| Cooldown Action | - | X | X | - | X | - | - | - | - | - | - | - |

## 5. Flow-connection registry

Same-screen destinations mean a component/state transition, not another full-screen frame. External email-link events are anchored to the last SmartHire screen that issued or offered the message; the external inbox itself is an annotation node.

### UC-AUTH-01

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-AUTH-LOGIN | 1 | - | S-AUTH-REGISTER | Create account | Basic |
| S-AUTH-REGISTER | 5 | - | S-AUTH-REGISTER | Submit / validating | Basic |
| S-AUTH-REGISTER | 12 | - | S-AUTH-EMAIL-PENDING | Account pending; verification sent | Success |
| S-AUTH-EMAIL-PENDING | 13 | - | UC-AUTH-02 | Continue by email link | Success |
| S-AUTH-REGISTER | 6 | AF-01 | S-AUTH-REGISTER | Show required-field errors | Alternative |
| S-AUTH-REGISTER | 5 | AF-02 | S-AUTH-REGISTER | Invalid email | Alternative |
| S-AUTH-REGISTER | 4 | AF-03 | S-AUTH-REGISTER | Password requirements unmet | Alternative |
| S-AUTH-REGISTER | 5 | AF-04 | S-AUTH-REGISTER | Passwords do not match | Alternative |
| S-AUTH-REGISTER | 6 | AF-05 | S-AUTH-REGISTER | Neutral existing-email response | Alternative |
| S-AUTH-REGISTER | 7 | AF-06 | S-AUTH-LOGIN | Cancel registration | Alternative |
| S-AUTH-REGISTER | 11 | EF-01 | S-AUTH-EMAIL-PENDING | Delivery issue / resend | Exception |
| S-AUTH-REGISTER | 9 | EF-02 | S-AUTH-REGISTER | Creation failed / retry | Exception |

### UC-AUTH-02

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-AUTH-EMAIL-PENDING | 1 | - | S-AUTH-LINK-STATUS | Open verification link | Basic |
| S-AUTH-LINK-STATUS | 9 | - | S-AUTH-LOGIN | Verification successful / Log in | Success |
| S-AUTH-EMAIL-PENDING | 3 | AF-01 | S-AUTH-LINK-STATUS | Invalid link | Alternative |
| S-AUTH-LINK-STATUS | 3 | AF-01 | S-AUTH-EMAIL-PENDING | Request new message | Alternative |
| S-AUTH-EMAIL-PENDING | 3 | AF-02 | S-AUTH-LINK-STATUS | Link expired | Alternative |
| S-AUTH-LINK-STATUS | 3 | AF-02 | S-AUTH-EMAIL-PENDING | Resend verification | Alternative |
| S-AUTH-EMAIL-PENDING | 3 | AF-03 | S-AUTH-LINK-STATUS | Link already used | Alternative |
| S-AUTH-EMAIL-PENDING | 4 | AF-04 | S-AUTH-LINK-STATUS | Already verified | Success |
| S-AUTH-EMAIL-PENDING | 1 | AF-05 | S-AUTH-EMAIL-PENDING | Submit email / neutral response | Alternative |
| S-AUTH-EMAIL-PENDING | 1 | AF-06 | S-AUTH-EMAIL-PENDING | Resend blocked / cooldown | Alternative |
| S-AUTH-LINK-STATUS | 5 | EF-01 | S-AUTH-LINK-STATUS | Activation failed / retry | Exception |

### UC-AUTH-03

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-AUTH-LOGIN | 4 | - | S-AUTH-LOGIN | Sign in / authenticating | Basic |
| S-AUTH-LOGIN | 11 | - | S-APP-DASHBOARD | Signed in / default destination | Success |
| S-AUTH-LOGIN | 11 | - | requested protected screen | Signed in / retained destination | Success |
| S-AUTH-LOGIN | 6-7 | AF-01 | S-AUTH-LOGIN | Invalid credentials | Alternative |
| S-AUTH-LOGIN | 8 | AF-02 | S-AUTH-EMAIL-PENDING | Verification required / resend | Alternative |
| S-AUTH-LOGIN | 8 | AF-03 | S-AUTH-LOGIN | Temporarily restricted | Alternative |
| S-AUTH-LOGIN | 8 | AF-04 | S-AUTH-LOGIN | Suspended / support guidance | Alternative |
| S-AUTH-LOGIN | 2 | AF-05 | UC-AUTH-05 / S-AUTH-RECOVERY-REQUEST | Forgot password | Alternative |
| S-AUTH-LOGIN | 1 | AF-06 | S-APP-DASHBOARD | Existing session | Success |
| S-AUTH-LOGIN | 4 | AF-07 | S-AUTH-LOGIN | Rate limited / retry later | Alternative |
| S-AUTH-LOGIN | 4 | EF-01 | S-AUTH-LOGIN | Service unavailable | Exception |

### UC-AUTH-04

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1-2 | - | S-APP-DASHBOARD | Open account menu | Basic |
| S-APP-DASHBOARD | 3 | - | S-AUTH-LOGIN | Log out | Success |
| S-APP-DASHBOARD | 4 | AF-01 | S-AUTH-LOGIN | Session already expired | Alternative |
| S-APP-DASHBOARD | 5 | EF-01 | S-AUTH-LOGIN | Local logout completed | Exception |

The same account-menu connectors apply from every protected canonical screen.

### UC-AUTH-05

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-AUTH-LOGIN | 1 | - | S-AUTH-RECOVERY-REQUEST | Forgot password | Basic |
| S-AUTH-RECOVERY-REQUEST | 4 | - | S-AUTH-RECOVERY-REQUEST | Request accepted | Basic |
| S-AUTH-RECOVERY-REQUEST | 8-10 | - | S-AUTH-RESET-PASSWORD | Open valid reset link | Basic |
| S-AUTH-RESET-PASSWORD | 11 | - | S-AUTH-RESET-PASSWORD | Submit new password | Basic |
| S-AUTH-RESET-PASSWORD | 15 | - | S-AUTH-LINK-STATUS | Password reset successful | Success |
| S-AUTH-RECOVERY-REQUEST | 3 | AF-01 | S-AUTH-RECOVERY-REQUEST | Same neutral response | Alternative |
| S-AUTH-RECOVERY-REQUEST | 9 | AF-02 | S-AUTH-LINK-STATUS | Invalid/expired reset link | Alternative |
| S-AUTH-LINK-STATUS | 9 | AF-02 | S-AUTH-RECOVERY-REQUEST | Request another message | Alternative |
| S-AUTH-RESET-PASSWORD | 12 | AF-03 | S-AUTH-RESET-PASSWORD | Password policy error | Alternative |
| S-AUTH-RESET-PASSWORD | 12 | AF-04 | S-AUTH-RESET-PASSWORD | Password mismatch | Alternative |
| S-AUTH-RESET-PASSWORD | 12 | AF-05 | S-AUTH-RESET-PASSWORD | Choose a different password | Alternative |
| S-AUTH-RECOVERY-REQUEST | 7 | EF-01 | S-AUTH-RECOVERY-REQUEST | Neutral response retained | Exception |
| S-AUTH-RESET-PASSWORD | 13 | EF-02 | S-AUTH-RESET-PASSWORD | Update failed / retry | Exception |

### UC-AUTH-06

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1 | - | S-ACC-SECURITY | Account security | Basic |
| S-ACC-SECURITY | 4 | - | S-ACC-SECURITY | Save password / processing | Basic |
| S-ACC-SECURITY | 10 | - | S-ACC-SECURITY | Password changed | Success |
| S-ACC-SECURITY | 5 | AF-01 | S-ACC-SECURITY | Current password incorrect | Alternative |
| S-ACC-SECURITY | 6 | AF-02 | S-ACC-SECURITY | Policy error | Alternative |
| S-ACC-SECURITY | 6 | AF-03 | S-ACC-SECURITY | Confirmation mismatch | Alternative |
| S-ACC-SECURITY | 6 | AF-04 | S-ACC-SECURITY | New equals current | Alternative |
| S-ACC-SECURITY | 6 | AF-05 | S-ACC-SECURITY | Cancel / stored state | Alternative |
| S-ACC-SECURITY | 1 | AF-06 | S-AUTH-LOGIN | Session expired | Alternative |
| S-ACC-SECURITY | 7 | EF-01 | S-ACC-SECURITY | Update failed / retry | Exception |

### UC-AUTH-07

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1-7 | - | S-ACC-ACCOUNT-INFO | Authorized: account information | Basic |
| S-APP-DASHBOARD | 1-7 | - | S-ACC-PREFERENCES | Authorized: preferences | Basic |
| S-APP-DASHBOARD | 1-7 | - | S-ACC-SECURITY | Authorized: security | Basic |
| S-APP-DASHBOARD | 1-7 | - | S-PROF-PROFILE | Authorized: candidate profile | Basic |
| S-PROF-PROFILE | 1-7 | - | S-PROF-CV-UPLOAD | Authorized: CV upload | Basic |
| S-PROF-CV-UPLOAD | 1-7 | - | S-PROF-CV-REVIEW | Authorized: parsed review | Basic |
| S-APP-DASHBOARD | 3 | AF-01 | UC-AUTH-03 / S-AUTH-LOGIN | No session; retain destination | Alternative |
| S-APP-DASHBOARD | 3 | AF-02 | S-AUTH-LOGIN | Session expired | Alternative |
| S-APP-DASHBOARD | 6 | AF-03 | S-SHARED-ROUTE-STATUS | Access denied | Alternative |
| S-APP-DASHBOARD | 5 | AF-04 | S-SHARED-ROUTE-STATUS | Account suspended | Alternative |
| S-APP-DASHBOARD | 6 | AF-05 | S-SHARED-ROUTE-STATUS | Resource not found | Alternative |
| S-APP-DASHBOARD | 6 | EF-01 | S-SHARED-ROUTE-STATUS | Authorization unavailable | Exception |

### UC-ACC-01

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1 | - | S-ACC-ACCOUNT-INFO | Account settings | Basic |
| S-ACC-ACCOUNT-INFO | 3-4 | - | S-ACC-ACCOUNT-INFO | Edit | Basic |
| S-ACC-ACCOUNT-INFO | 6 | - | S-ACC-ACCOUNT-INFO | Save / validating | Basic |
| S-ACC-ACCOUNT-INFO | 11 | - | S-ACC-ACCOUNT-INFO | Updated successfully | Success |
| S-ACC-ACCOUNT-INFO | 7 | AF-01 | S-ACC-ACCOUNT-INFO | Invalid fields | Alternative |
| S-ACC-ACCOUNT-INFO | 5 | AF-02 | UC-AUTH-02 / S-AUTH-EMAIL-PENDING | Verify changed email | Alternative |
| S-ACC-ACCOUNT-INFO | 7 | AF-03 | S-ACC-ACCOUNT-INFO | Email unavailable | Alternative |
| S-ACC-ACCOUNT-INFO | 6 | AF-04 | S-ACC-ACCOUNT-INFO | Cancel / stored view | Alternative |
| S-ACC-ACCOUNT-INFO | 8 | AF-05 | S-ACC-ACCOUNT-INFO | Reload latest / review | Alternative |
| S-ACC-ACCOUNT-INFO | 1 | AF-06 | S-AUTH-LOGIN | Session expired | Alternative |
| S-ACC-ACCOUNT-INFO | 9 | EF-01 | S-ACC-ACCOUNT-INFO | Save failed / retry | Exception |

### UC-ACC-02

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1 | - | S-ACC-PREFERENCES | Preferences | Basic |
| S-ACC-PREFERENCES | 4 | - | S-ACC-PREFERENCES | Save changes | Basic |
| S-ACC-PREFERENCES | 8 | - | S-ACC-PREFERENCES | Preferences saved | Success |
| S-ACC-PREFERENCES | 5 | AF-01 | S-ACC-PREFERENCES | Unsupported value corrected | Alternative |
| S-ACC-PREFERENCES | 3 | AF-02 | S-ACC-PREFERENCES | Restore defaults / confirm | Alternative |
| S-ACC-PREFERENCES | 4 | AF-03 | S-ACC-PREFERENCES | Cancel / stored values | Alternative |
| S-ACC-PREFERENCES | 5 | AF-04 | S-ACC-PREFERENCES | Reload latest / reapply | Alternative |
| S-ACC-PREFERENCES | 1 | AF-05 | S-AUTH-LOGIN | Session expired | Alternative |
| S-ACC-PREFERENCES | 6 | EF-01 | S-ACC-PREFERENCES | Save failed / retry | Exception |

### UC-PROF-01

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-APP-DASHBOARD | 1 | - | S-PROF-PROFILE | My Profile | Basic |
| S-PROF-PROFILE | 3-4 | - | S-PROF-PROFILE | Edit profile | Basic |
| S-PROF-PROFILE | 6 | - | S-PROF-PROFILE | Save profile | Basic |
| S-PROF-PROFILE | 11 | - | S-PROF-PROFILE | Profile updated | Success |
| S-PROF-PROFILE | 2 | AF-01 | S-PROF-PROFILE | Create first profile | Alternative |
| S-PROF-PROFILE | 7 | AF-02 | S-PROF-PROFILE | Required sections missing | Alternative |
| S-PROF-PROFILE | 7 | AF-03 | S-PROF-PROFILE | Invalid date range | Alternative |
| S-PROF-PROFILE | 4 | AF-04 | UC-PROF-02 / S-PROF-CV-UPLOAD | Upload CV | Alternative |
| S-PROF-PROFILE | 6 | AF-05 | S-PROF-PROFILE | Cancel / stored profile | Alternative |
| S-PROF-PROFILE | 8 | AF-06 | S-PROF-PROFILE | Reload latest / review | Alternative |
| S-PROF-PROFILE | 1 | AF-07 | S-AUTH-LOGIN | Session expired | Alternative |
| S-PROF-PROFILE | 9 | EF-01 | S-PROF-PROFILE | Save failed / retry | Exception |

### UC-PROF-02

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-PROF-PROFILE | 1 | - | S-PROF-CV-UPLOAD | Upload CV | Basic |
| S-PROF-CV-UPLOAD | 3 | - | S-PROF-CV-UPLOAD | File selected / validate | Basic |
| S-PROF-CV-UPLOAD | 6 | - | S-PROF-CV-UPLOAD | Confirm upload / parse | Basic |
| S-PROF-CV-UPLOAD | 11 | - | UC-PROF-03 / S-PROF-CV-REVIEW | Review parsed information | Success |
| S-PROF-CV-UPLOAD | 4 | AF-01 | S-PROF-CV-UPLOAD | Unsupported format | Alternative |
| S-PROF-CV-UPLOAD | 4 | AF-02 | S-PROF-CV-UPLOAD | File too large | Alternative |
| S-PROF-CV-UPLOAD | 4 | AF-03 | S-PROF-CV-UPLOAD | Invalid document | Alternative |
| S-PROF-CV-UPLOAD | 5 | AF-04 | S-PROF-CV-UPLOAD | Unsafe file rejected | Alternative |
| S-PROF-CV-UPLOAD | 6 | AF-05 | S-PROF-PROFILE | Cancel upload | Alternative |
| S-PROF-CV-UPLOAD | 4 | AF-06 | S-PROF-CV-UPLOAD | Duplicate / replace or cancel | Alternative |
| S-PROF-CV-UPLOAD | 10 | AF-07 | S-PROF-CV-REVIEW | Review low-confidence fields | Alternative |
| S-PROF-CV-UPLOAD | 8 | EF-01 | S-PROF-CV-UPLOAD | Parser unavailable / retry | Exception |
| S-PROF-CV-UPLOAD | 8 | EF-01 | S-PROF-PROFILE | Enter profile manually | Exception |
| S-PROF-CV-UPLOAD | 7 | EF-02 | S-PROF-CV-UPLOAD | Upload/storage failed / retry | Exception |

### UC-PROF-03

| Source | BF step | AF/EF | Destination/invoked UC | Connector label | Category |
|---|---:|---|---|---|---|
| S-PROF-CV-UPLOAD | 1 | - | S-PROF-CV-REVIEW | Parsing complete | Basic |
| S-PROF-CV-REVIEW | 6 | - | S-PROF-CV-REVIEW | Confirm and update profile | Basic |
| S-PROF-CV-REVIEW | 12 | - | S-PROF-PROFILE | Profile updated | Success |
| S-PROF-CV-REVIEW | 7 | AF-01 | S-PROF-CV-REVIEW | Complete required fields | Alternative |
| S-PROF-CV-REVIEW | 4 | AF-02 | S-PROF-CV-REVIEW | Remove parsed entry | Alternative |
| S-PROF-CV-REVIEW | 5 | AF-03 | S-PROF-CV-REVIEW | Keep existing value | Alternative |
| S-PROF-CV-REVIEW | 5 | AF-04 | S-PROF-CV-REVIEW | Use parsed value | Alternative |
| S-PROF-CV-REVIEW | 5 | AF-05 | S-PROF-PROFILE | Confirm discard | Alternative |
| S-PROF-CV-REVIEW | 5 | AF-06 | S-PROF-PROFILE | Save draft / return later | Alternative |
| S-PROF-PROFILE | 1 | AF-06 | S-PROF-CV-REVIEW | Resume draft review | Alternative |
| S-PROF-CV-REVIEW | 8 | AF-07 | S-PROF-CV-REVIEW | Resolve latest conflicts | Alternative |
| S-PROF-CV-REVIEW | 9 | EF-01 | S-PROF-CV-REVIEW | Save failed / retry | Exception |

## 6. Proposed Figma pages

| Page | Contents |
|---|---|
| 00 Cover & Legend | Scope, source link, assumptions, screen-ID convention, connector legend, status/state legend, counts, ambiguity register |
| 01 Foundations | Existing Reqwise Tokens; Inter typography; 4/8/12/16/20/24/32 spacing; radii; 1440 desktop grid; focus/accessibility rules; semantic colors |
| 02 Components | Reorganize/reuse the existing 35 authentication components; add only the 52 missing app/settings/profile/CV variants after reuse checks |
| 03 Shared Screens | S-AUTH-EMAIL-PENDING, S-AUTH-LINK-STATUS, S-AUTH-LOGIN, S-APP-DASHBOARD, S-SHARED-ROUTE-STATUS and shared authenticated shell examples |
| 10 Authentication | S-AUTH-REGISTER, S-AUTH-RECOVERY-REQUEST, S-AUTH-RESET-PASSWORD and their component/state specimens; flow annotations |
| 20 Account Settings | S-ACC-ACCOUNT-INFO, S-ACC-PREFERENCES, S-ACC-SECURITY |
| 30 Candidate Profile & CV | S-PROF-PROFILE, S-PROF-CV-UPLOAD, S-PROF-CV-REVIEW |
| 90 Flow Map | One lane per use case; Basic/Alternative/Exception/Success connectors; invoked-UC nodes; backend decisions and security annotations |

Existing-document migration note: the current document has Page 1, 02 Authentication, and empty Page 3. The existing 02 Authentication page already contains eight 1440 x 1024 state frames covering registration and verification-pending states plus the 35 reusable components. A later implementation phase should preserve these assets, map them to the canonical IDs, consolidate duplicate full-screen states into component/state specimens, and avoid destructive replacement until visual and layout audits pass.

## 7. Ambiguities and missing UI decisions

1. Frame height is unspecified. Use 1024 px provisionally because the existing frames are 1440 x 1024.
2. Light/dark mode is unspecified. Use light only; no dark variants are planned.
3. UC-AUTH-04's heading says Log Out and End Session, but its information table says Log In. The heading/behavior is used.
4. Logout destination is public home or login. The plan uses login because no public-home requirements are supplied.
5. Dashboard and retained protected-page content are not specified. S-APP-DASHBOARD should be a minimal authenticated landing/flow hub, not an invented recruitment feature.
6. Exact neutral security copy, support/appeal route and contact details are missing.
7. Resend hourly limits and cooldown recovery behavior are not fully specified beyond the 60-second rule.
8. Editable account fields beyond full name and phone, phone format, and changed-email confirmation destination are unspecified.
9. Preference catalogue, defaults, language list, privacy choices, notification channels/frequencies, and mandatory security-notification labels are unspecified.
10. Candidate-profile required fields, field limits, skill taxonomy, work/education schemas, completion formula, and date rules are unspecified.
11. Supported CV formats and maximum size are explicitly required but not defined.
12. CV upload progress semantics, retry persistence, quarantine copy, duplicate-file comparison, and manual-entry destination details are missing.
13. Parsed-data merge granularity is unclear: global, per section, per entry, or per field. The plan assumes per-conflict choice with a global default.
14. Draft retention duration, draft visibility, and resume entry point are not specified.
15. Concurrent-update resolution is described only as reload/review; no side-by-side diff or merge policy is defined.
16. Social login, SSO, OTP/MFA, remember-me, and password visibility behavior are not in the specification and are excluded.
17. Accessibility target is not stated. Implementation should adopt WCAG 2.2 AA, visible focus, keyboard operation, and non-color-only status cues unless directed otherwise.

## 8. Phase summary

- Use cases: 12
- Canonical full screens: 14
- Directly shared screens: 5
- Existing reusable component variants: 35
- Proposed new component/state variants: 52
- Planned component/state variants after implementation: 87
- Figma changes in this phase: none
