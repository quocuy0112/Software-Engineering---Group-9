# DGM-01 — Specification of Identity, Access, and Profile

## Use-Case Specifications

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*   
**Version:** 
- V1.1 (20/7/2026) - First initialization (UC1 --> 3)
- V1.2 (22/7/2026) - Second initialization (UC3 --> 7)
- V1.3 (23/7/2026) - Third initialization (UC7 --> 12)

# 1. UC-AUTH-01 — Register Account

## 1.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-01 |
| **Use-Case Name** | Register Account |
| **Primary Actor** | Visitor |
| **Supporting Actor** | Email Delivery Service |
| **Priority** | High |
| **Trigger** | The visitor selects **Create account** |

## 1.2. Brief Description
This use case allows a visitor to create a standard SmartHire account by providing a full name, email address, and password. The system creates a pending account and sends an email-verification message.

## 1.3. Preconditions
1. The visitor does not have an active authenticated session.
2. The registration service and account database are available.
3. The visitor can access the supplied email address.

## 1.4. Basic Flow
1. The Visitor selects **Create account**.
2. The System displays the registration form.
3. The Visitor enters full name, email address, password, and password confirmation.
4. The System will check the valid password whether it contains upper_case letter, lower_case letter, number and special character.
5. The Visitor accepts the Terms of Service and submits the form
6. The System validates the submitted information.
7. The System verifies that the email address is not already associated with an account.
8. The System securely hashes the password.
9. The System creates an account with the PENDING_VERIFICATION status.
10. The System creates an a single-use email-verification token. 
11. The Email Delivery Service sends a verification message.
12. The System displays the verification-pending page.
13. Account activation continues through **UC-AUTH-02 — Verify Email Address**.

## 1.5. Alternative Flows

### 1.5.1. AF-01 — Required Information Is Missing
At Step 6, if a required field is missing:
1. The System highlights the missing fields.
2. The System preserves valid entered information.
3. The use case resumes at Step 3.

### 1.5.2. AF-02 — Email Format is Invalid
At Step 5, if the email format is invalid:
1. The System displays an email-format-validation message
2. The use case resumes at Step 3.

### 1.5.3. AF-03 — Password Does Not Satisfy the Rule
At Step 4, if the password does not match the rule:
1. The System displays the applicable password requirements.
2. The System clears the password fields.
3. The use case resumes at Step 3.

### 1.5.4. AF-04 — Password Confirmation Does Not Match
At Step 5, if the two password values do nat match:
1. The System displays a password-mismatch message.
2. The use case resumes at Step 3.

### 1.5.5. AF-05 — Email Address Is Already Registered
At Step 6, if the email is already associated with an account:
1. The System displays a neutral response instructing the Visitor to check the email inbox or log in.
2. The System does not disclose detailed account status.
3. The use case ends without creating another account or the Visitor try another email which is not associated with any account.

### 1.5.6. AF-06 — Visitor Cancels Registration
Before Step 8, the Visitor may leave or cancel the form. The System does not create an account.

### 1.5.7. EF-01 — Email Delivery Fails
At Step 11, if the verification message cannot be delivered
1. The System retains the pending account.
2. The System records the failed delivery.
3. The System displays the verification-pending page with a resend option.
4. The use case ends.

### 1.5.8. EF-02 — Account Creation Fails
At Step 9, if the account cannot be saved:
1. The System does not report successful registration.
2. The System records the failure.
3. The System displays a general retry message.
4. The use case ends.

## 1.6. Postconditions
### 1.6.1. Success Postconditions
- A pending account exists.
- A verification token has been generated.
- A verification message has been sent or scheduled.
- No authenticated session has been established.

### 1.6.2 Failure Postconditions
- No incomplete active account is created.
- Password values are never stored or logged in plain text.

## 1.7. Special Requirements
- Passwords must be hashed using an approved adaptive password-hashing algorithm.
- The registration endpoint must enforce abuse-control limits.
- Verification tokens must be single-use, securely generated, and time-limited.
- Sensitive values must not appear in logs or URLs other than the required opaque token.

## 1.8 Extension Points
### Email Verification 
After the pending account is created, account activation proceeds through UC-AUTH-02.

---
# 2. UC-AUTH-02 — Verify Email Address

## 2.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-02 |
| **Use-Case Name** | Verify Email Address |
| **Primary Actor** | Visitor |
| **Supporting Actor** | Email Delivery Service |
| **Priority** | High |
| **Trigger** | The Visitor opens an email-verification link. |

## 2.2. Brief Description
This use case confirms that the Visitor controls the registered email address and activates the correspoding pending account

## 2.3. Preconditions
1. A pending account exists.
2. A verification token has been issued for the account

## 2.4. Basic Flow
1. The Visitor opens the verification link.
2. The System extracts the verification token.
3. The System validates the token’s signature, purpose, expiration time, and unused status.
4. The System finds the corresponding pending account.
5. The System marks the email address as verified.
6. The System changes the account status to ACTIVE.
7. The System invalidates the verification token.
8. The System records the verification event.
9. The System displays a verification-success page with a login action.

## 2.5. Alternative Flows

### 2.5.1. AF-01 — Verification Token Is Invalid
At Step 3, if the token is invalid, the System displays a neutral invalid-link message and offers a new verification-message request.

### 2.5.2. AF-02 — Verification Token Has Expired
At Step 3, if the token has expired, the System displays an expired-link message and offers a resend action.

### 2.5.3. AF-03 — Token Has Already Been Used
At Step 3, if the token has already been used, the System displays a neutral message indicating that the link is no longer valid.

### 2.5.4. AF-04 — Account Is Already Verified
At Step 4, if the account is already active, the System displays the verification-success page without changing the account.

### 2.5.5. AF-05 — Visitor Requests Another Verification Message
1. The Visitor submits the email address.
2. The System displays the same neutral response regardless of whether a matching account exists.
3. If an eligible pending account exists, the System invalidates previous verification tokens and sends a new token.

### 2.5.6. AF-06 — Resend Is Rate-Limited
If fewer than 60 seconds have passed since the previous request, or the hourly limit is exceeded, the System displays the remaining cooldown time.

### 2.5.7.EF-01 — Activation Cannot Be Saved
If Steps 5–7 cannot be committed atomically, the System rolls back the operation, records the failure, and displays a retry message.

## 2.6. Postconditions
- On success, the account is active and the email address is verified.
- The used verification token cannot be used again.
- On the failure, the account remains in its  previous consistent state.

## 2.7. Special Requirements
- Token validation must not expose internal token contents.
- Invalid-token attempts must be rate-limited.
- Account activation and token invalidation must be atomic.
- Resend responses must prevent account enumeration.

---
# 3. UC-AUTH-03 — Log In

## 3.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-03 |
| **Use-Case Name** | Log In |
| **Primary Actor** | Visitor |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The Visitor submits the login form.|

## 3.2. Brief Description
This use case authenticates a registered account holder and establishes a secure session.

## 3.3. Preconditions
1. The Visitor is not currently authenticated.
2. An active, verified account exists.

## 3.4. Basic Flow
1. The Visitor opens the login page.
2. The System displays the login form.
3. The Visitor enters an email address and password.
4. The Visitor submits the form.
5. The System validates the request format.
6. The System finds the account using the normalized email address.
7. The System verifies the password.
8. The System verifies that the account is active and permitted to log in.
9. The System creates a secure authenticated session.
10. The System records the successful login.
11. The System redirects the Authenticated User to the requested protected page or default dashboard.

## 3.5. Alternative Flows

### 3.5.1. AF-01 — Invalid Credentials
At Steps 6–7, if the account is not found or the password is incorrect:
1. The System records the failed attempt.
2. The System displays the same neutral invalid-credentials message.
3. The use case resumes at Step 3.

### 3.5.2. AF-02 — Email Is Not Verified
At Step 8, if the account is pending verification, the System displays a verification-required message with a resend option.

### 3.5.3. AF-03 —  Account Is Temporarily Locked
At Step 8, if the account is temporarily locked, the System displays a neutral temporary-restriction message.

### 3.5.4. AF-04 — Account Is Suspended or Disabled
At Step 8, the System denies access and provides the permitted support or appeal instruction.

### 3.5.5. AF-05 — Visitor Selects Forgot Password
At Step 2, the use case invokes **UC-AUTH-05 — Recover Password**.

### 3.5.6. AF-06 — Valid Session Already Exists
If a valid session exists, the System redirects the user to the requested page without creating another session.

### 3.5.7. AF-07 — Login Rate Limit Is Exceeded
If the account or source exceeds the configured limit, the System rejects the attempt and displays a retry-later message.

### 3.5.8. EF-01 — Authentication Service Is Unavailable
The System does not establish a session and displays a temporary-unavailability message.

## 3.6. Postconditions 
- On success, a valid authenticated session exists.
- On failure, no session is created.
- Login success or failure is recorded without logging the password.

## 3.7. Special Requirements
- Login errors must not reveal whether an account exists.
- Five failed attempts per account or 20 attempts per IP address within 15 minutes trigger the configured cooldown.
- Session identifiers must be regenerated after authentication.
- Authentication cookies must be secure and inaccessible to client-side scripts.

## 3.8. Extension Points
- **Forgot Password**: At the login form, the Visitor may initiate **UC-AUTH-05**.
- **Protected Page Authentication**: This use case extends **UC-AUTH-07** when no valid session exists.

---

# 4. UC-AUTH-04 — Log Out and End Session

## 4.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-04 |
| **Use-Case Name** | Log In |
| **Primary Actor** | Authenticated User |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The Authenticated User selects **Log Out**|

## 4.2. Brief Description
This use case securely terminates the current authenticated session.

## 4.3. Preconditions
- The user has or recently had an authenticated session

## 4.4. Basic Flow
1. The Authenticated User opens the account menu.
2. The System displays the available account actions.
3. The Authenticated User selects **Log out**.
4. The System identifies the current session.
5. The System revokes the server-side session or refresh credential.
6. The System clears the authentication cookies.
7. The System records the logout event.
8. The System redirects the Visitor to the public home or login page.

## 4.5. Alternative Flows

### 4.5.1. AF-01 — Session Has Already Expired
The System clears any remaining local authentication data and redirects the Visitor to the login page.

### 4.5.2. EF-01 — Server-Side Revocation Fails
1. The System still clears local authentication cookies.
2. The System records or queues the revocation failure.
3. The System redirects the Visitor to the public page.
4. The System does not prevent the local logout from completing.

## 4.6. Postconditions
- The current browser no longer has usable authentication credentials.
- Protected pages require authentication again.

## 4.7. Special Requirements
- Logout must be idempotent.
- Failure to write an audit record must not prevent session invalidation.
- Cached protected content must not remain available after logout.

---

# 5. UC-AUTH-05 — Recover Password

## 5.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-05 |
| **Use-Case Name** | Recover Password |
| **Primary Actor** | Visitor |
| **Supporting Actor** | Email Delivery Service |
| **Priority** | High |
| **Trigger** | The Visitor selects **Forgot password**.|


## 5.2. Brief Description
This use case allows a Visitor who cannot log in to establish a new password through a time-limited email recovery link.

## 5.3. Preconditions
- The Visitor is not required to be authenticated.
- The Visitor can access the registered email inbox.

## 5.4. Basic Flow
1. The Visitor selects Forgot password.
2. The System displays the password-recovery form.
3. The Visitor enters an email address.
4. The System accepts the request and displays a neutral response.
5. The System finds an eligible account without revealing the result.
6. The System creates a single-use password-reset token.
7. The Email Delivery Service sends the password-reset message.
8. The Visitor opens the reset link.
9. The System validates the reset token.
10. The System displays the new-password form.
11. The Visitor enters and confirms a new password.
12. The System validates the new password.
13. The System securely updates the password.
14. The System invalidates the reset token and existing account sessions.
15. The System displays a password-reset-success page.

## 5.5. Alternative Flows

### 5.5.1. AF-01 — Email Is Invalid or Not Registered
The System displays the same neutral response as Step 4 and does not disclose whether an account exists.

### 5.5.2. AF-02 — Reset Token Is Invalid, Expired, or Used
At Step 9, the System displays an invalid-or-expired-link page with an option to request another message.

### 5.5.3. AF-03 — Password Does Not Satisfy Policy
At Step 12, the System displays the applicable password requirements and resumes at Step 11.

### 5.5.4. AF-04 — Password Confirmation Does Not Match
The System displays a mismatch message and resumes at Step 11.

### 5.5.5. AF-05 — New Password Matches Current Password
The System asks the Visitor to choose a different password.

### 5.5.6. EF-01 — Email Delivery Fails
The System retains the neutral public response, records the delivery failure, and does not reveal the account status.

### 5.5.7. EF-02 — Password Update Fails
The System preserves the old password, keeps the reset operation consistent, and displays a retry message.

## 5.6. Postconditions
- On success, the password is replaced and previous sessions are invalidated.
- The used reset token cannot be reused.
- On failure, the existing password remains valid unless the update was committed successfully.

## 5.7. Special Requirements
- Public recovery responses must prevent account enumeration.
- Reset tokens must be single-use and time-limited.
- Reset links must use HTTPS.
- Recovery requests must be rate-limited and audited.

---

# 6. UC-AUTH-06 — Change Password

## 6.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-06 |
| **Use-Case Name** | Change Password |
| **Primary Actor** | Authenticated User |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The Authenticated User selects **Change password**.|

## 6.2. Brief Description
This use case allows an Authenticated User to replace the current account password.

## 6.3. Preconditions
1. The user has a valid authenticated session.
2. The account uses password-based authentication.

## 6.4. Basic Flow
1. The Authenticated User opens account security settings.
2. The System displays the change-password form.
3. The Authenticated User enters the current password.
4. The Authenticated User enters and confirms a new password.
5. The System verifies the current password.
6. The System validates the new password and confirmation.
7. The System securely hashes and stores the new password.
8. The System invalidates other active account sessions.
9. The System records the password-change event.
10. The System displays a success confirmation.

## 6.5. Alternative Flows

### 6.5.1. AF-01 — Current Password Is Incorrect
The System displays a neutral error and resumes at Step 3.

### 6.5.2. AF-02 — New Password Violates Policy
The System displays the applicable requirements and resumes at Step 4.

### 6.5.3. AF-03 — Password Confirmation Does Not Match
The System displays a mismatch message and resumes at Step 4.

### 6.5.4. AF-04 — New Password Equals Current Password
The System requires the user to choose a different password.

### 6.5.5. AF-05 — User Cancels the Change
Before Step 7, the user cancels. The existing password remains unchanged.

### 6.5.6. AF-06 — Session Has Expired
The System redirects the user to login and preserves no password values.

### 6.5.7. EF-01 — Password Update Fails
The System keeps the existing password, records the failure, and displays a retry message.

## 6.6. Postconditions
- On success, the new password is active
- Other active sessions are invalidated.
- On failure, the existing password remains unchanged.

## 6.7 Special Requirements
- Password values must never be logged.
- The current password must be reverified before the change.
- The update and session invalidation must be performed consistently.

---

# 7. UC-AUTH-07 — Access Protected Account Page

## 7.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-AUTH-07 |
| **Use-Case Name** | Access Protected Account Page |
| **Primary Actor** | Authenticated User |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | A person requests a protected account page.|

## 7.2. Brief Description
This use case verifies the requester's session and authorization before displaying a protected account page.

## 7.3. Preconditions
- The requested route is classified as protected

## 7.4. Basic Flow

1. The Authenticated User requests a protected account page.
2. The System reads the authentication credential.
3. The System validates the session.
4. The System loads the account and applicable authorization context.
5. The System verifies that the account is active.
6. The System verifies that the user is authorized to access the requested resource.
7. The System displays the protected page.

## 7.5. Alternative Flows

### 7.5.1. AF-01 — No Authenticated Session Exists
The System invokes UC-AUTH-03 — Log In and retains the requested destination.

### 7.5.2. AF-02 — Session Has Expired
The System clears invalid authentication data and redirects the person to login.

### 7.5.3. AF-03 — User Lacks Permission
The System denies access and displays an access-denied page.

### 7.5.4. AF-04 — Account Is Suspended
The System terminates the session and displays the permitted support or appeal information.

### 7.5.5. AF-05 — Requested Resource Does Not Exist
The System displays a not-found page without exposing unauthorized resource information.

### 7.5.6. EF-01 — Authorization Service Is Unavailable
The System denies access by default and displays a temporary-error page.

## 7.6. Postconditions
- On success, the authorized page is displayed.
- On failure, protected data is not disclosed.

## 7.7. Special Requirements
- Authorization must be checked server-side.
- The system must deny access by default when authorization cannot be determined.
- Resource existence must not be disclosed to unauthorized users.

---

# 8. UC-ACC-01 — Manage Account Information

## 8.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-ACC-01 |
| **Use-Case Name** | Manage Account Information |
| **Primary Actor** | Authenticated User |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The user opens account-information settings.|

## 8.2. Brief Description
This use case allows an Authenticated User to view and update general account information.

## 8.3. Preconditions
1. The user has a valid authenticated session
2. The account is active

## 8.4. Basic Flow
1. The Authenticated User opens account settings.
2. The System displays the current account information.
3. The Authenticated User selects **Edit**.
4. The System displays editable fields.
5. The Authenticated User updates the full name, phone number, or other permitted information.
6. The Authenticated User submits the changes.
7. The System validates the submitted information.
8. The System verifies that the record has not been modified by another request.
9. The System saves the changes.
10. The System records the account-update event.
11. The System displays the updated information and a success message.

## 8.5. Alternative Flows

### 8.5.1. AF-01 — Submitted Information Is Invalid
The System identifies invalid fields, preserves valid input, and resumes at Step 5.

### 8.5.2. AF-02 — User Changes the Email Address
The System records the new email as pending, preserves the current verified email, and initiates email verification.

### 8.5.3. AF-03 — New Email Is Already Registered
The System displays a neutral unavailable-email message and resumes at Step 5.

### 8.5.4. AF-04 — User Cancels Editing
The System discards unsaved changes and displays the previously stored information.

### 8.5.5. AF-05 — Concurrent Update Is Detected
The System informs the user that the information has changed, reloads the current version, and asks the user to review the update again.

### 8.5.6. AF-06 — Session Has Expired
The System redirects the user to login without saving the changes.

### 8.5.7. EF-01 — Save Operation Fails
The System preserves the previous account information and displays a retry message.

## 8.6. Postconditions
- On success, valid account information is updated.
- On cancellation or failure, stored information remains unchanged.
- An email change does not become verified until verification succeeds.

## 8.7. Special Requirements
- Only explicity editable fields may be changed.
- Sensitive changes must be audited.
- Concurrent updates must not silently overwrite newer information.

## 8.8. Extension Points
- **Verify Changed Email Address**: Email verification is initiated when the user changes the account email address.

---

# 9. UC-ACC-02 — Manage Account Preferences

## 9.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-ACC-02 |
| **Use-Case Name** | Manage Account Preferences |
| **Primary Actor** | Authenticated User |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The user opens account preferences. |

## 9.2. Brief Description
This use case allows an Authenticated User to configure supported account, language, privacy, communication, and notification preferences.

## 9.3. Preconditions
- The user has a valid authenticated session.

## 9.4. Basic Flow
1. The Authenticated User opens account preferences.
2. The System displays the current preference values.
3. The Authenticated User changes one or more preferences.
4. The Authenticated User selects **Save changes**.
5. The System validates the selected values.
6. The System saves the preferences.
7. The System applies preferences that take effect immediately.
8. The System displays a success confirmation.

## 9.5. Alternative Flows

### 9.5.1. AF-01 — Unsupported Preference Value 
The System identifies the unsupported value and restores the nearest valid option.

### 9.5.2. AF-02 — User Restores Default Preferences
The System displays the default values, requests confirmation, and saves them after confirmation.

### 9.5.3. AF-03 — User Cancels Changes
The System discards unsaved changes and restores the stored values.

### 9.5.4. AF-04 — Concurrent Update Is Detected
The System reloads the latest preference values and asks the user to reapply the changes.

### 9.5.5. AF-05 — Session Has Expired
The System redirects the user to login without saving changes.

### 9.5.6. EF-01 — Preferences Cannot Be Saved
The System retains the previous values and displays a retry message.

## 9.6. Postconditions
- On success, validated preferences are stored.
- On failure or cancellation, previous preferences remain active.

## 9.7. Special Requirements
- Mandatory security notifications cannot be disabled.
- Preference changes must apply consistently across supported devices.
- Privacy-related preferences must comply with applicable policy.

---

# 10. UC-PROF-01 — Manage Candidate Profile

## 10.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-PROF-01 |
| **Use-Case Name** | Manage Candidate Profile |
| **Primary Actor** | Candidate |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | The Candidate opens the candidate profile. |

## 10.2. Brief Description
This use case allows a Candidate to create, view, and update professional profile information used for job applications and candidate screening.

## 10.3. Preconditions
1. The Candidate has a valid authenticated session.
2. The account is permitted to use candidate features.

## 10.4. Basic Flow
1.  Candidate opens **My Profile**.
2. The System displays the current candidate profile and completion status.
3. The Candidate selects **Edit profile**.
4. The System displays editable profile sections.
5. The Candidate updates personal summary, location, skills, work experience, education, or other supported information.
6. The Candidate submits the changes.
7. The System validates the submitted profile information.
8. The System checks for concurrent modifications.
9. The System saves the profile changes.
10. The System recalculates the profile-completion status.
11. The System displays the updated profile and success confirmation.

## 10.5. Alternative Flows

### 10.5.1. AF-01 — Candidate Creates the First Profile
If no profile exists, the System displays an empty profile form and creates the profile after valid submission.

### 10.5.2. AF-02 — Required Information Is Missing
The System highlights the incomplete sections and resumes at Step 5.

### 10.5.3. AF-03 — Experience or Education Dates Are Invalid
The System identifies the invalid date range and resumes at Step 5.

### 10.5.4. AF-04 — Candidate Uploads a CV
At Step 4, the Candidate may invoke **UC-PROF-02 — Upload and Parse CV**.

### 10.5.5. AF-05 — Candidate Cancels Editing
The System discards unsaved changes and displays the stored profile.

### 10.5.6. AF-06 — Concurrent Modification Is Detected
The System displays the latest profile version and asks the Candidate to review the changes again.

### 10.5.7. AF-07 — Session Has Expired
The System redirects the Candidate to login without saving unsaved information.

### 10.5.8. EF-01 — Profile Cannot Be Saved
The System retains the previous profile and displays a retry message.

## 10.6. Postconditions
- On success, the candidate profile contains the validated changes.
- Profile completion is recalculated.
- On cancellation or failure, the previous profile remains unchanged.

## 10.7. Special Requirements
- Only the Candidate and explicitly authorized platform functions may access private profile data.
- Profile fields must enforce documented length and format limits.
- Profile changes relevant to screening should be versioned or audited.

## 10.8. Extension Points
- **Upload CV**: At the profile-editing page, the Candidate may initiate **UC-PROF-02**.

---

# 11. UC-PROF-02 — Upload and Parse CV

## 11.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-PROF-02 |
| **Use-Case Name** | Upload and Parse CV |
| **Primary Actor** | Candidate |
| **Supporting Actor** | CV Parsing Service |
| **Priority** | High |
| **Trigger** | The Candidate selects **Upload CV** |

## 11.2. Brief Description
This use case allows a Candidate to upload a supported CV document and have structured profile information extracted from it.

## 11.3. Preconditions
1. The Candidate has a valid authenticated session.
2. The Candidate may access candidate-profile functions.
3. The CV Parsing Service is configured.

## 11.4. Basic Flow
1. The Candidate selects Upload CV.
2. The System displays file requirements and the upload control.
3. The Candidate selects a supported CV file.
4. The System validates the file name, type, size, and content signature.
5. The System scans the file for unsafe content.
6. The Candidate confirms the upload.
7. The System stores the file in protected storage.
8. The System sends the file for parsing.
9. The CV Parsing Service extracts supported candidate information.
10. The System receives and stores the parsing result with confidence information.
11. The System invokes **UC-PROF-03 — Review and Confirm Parsed CV**.

## 11.5. Alternative Flows

### 11.5.1. AF-01 — Unsupported File Type
The System rejects the file and displays the supported formats.

### 11.5.2. AF-02 — File Exceeds the Size Limit
The System rejects the file and displays the maximum permitted size.

### 11.5.3. AF-03 — File Is Empty, Corrupted, or Password-Protected
The System rejects the file and asks the Candidate to select another document.

### 11.5.4. AF-04 — Unsafe Content Is Detected
The System rejects and quarantines the file, records the event, and does not send it for parsing.

### 11.5.5. AF-05 — Candidate Cancels the Upload
Before Step 7, the Candidate cancels and no file is stored.

### 11.5.6. AF-06 — Duplicate File Is Selected
The System warns that the same file was previously uploaded and allows the Candidate to replace or cancel it.

### 11.5.7. AF-07 — Parsing Confidence Is Low
The System completes parsing but marks uncertain fields for manual review in UC-PROF-03.

### 11.5.8. EF-01 — CV Parsing Service Is Unavailable
The System records the failed parsing job and displays retry and manual-entry options.

### 11.5.9. EF-02 — Upload or Storage Fails
The System does not report a successful upload and displays a retry message.

## 11.6. Postconditions
- On success, the protected CV and its parsing result are available for review.
- Parsed information is not treated as confirmed profile data until **UC-PROF-03** succeeds.

## 11.7. Special Requirements
- Supported formats and maximum file size must be documented.
- File validation must use content signatures, not only extensions.
- CV files must be encrypted in transit and protected at rest.
- The file must not be publicly addressable.
- Parsing failures must be retryable without producing duplicate confirmed data.

## 11.8. Extension Points
- **Review Parsed Information**: After successful parsing, the System invokes **UC-PROF-03**.

---

# 12. UC-PROF-03 — Review and Confirm Parsed CV

## 12.1. Use-Case Information
| Field | Value |
|---|---|
| **Use-Case ID** | UC-PROF-03 |
| **Use-Case Name** | Review and Confirm Parsed CV |
| **Primary Actor** | Candidate |
| **Supporting Actor** | None |
| **Priority** | High |
| **Trigger** | CV parsing completes successfully. |

## 12.2. Brief Description
This use case allows the Candidate to review, correct, and confirm information extracted from an uploaded CV before it updates the candidate profile.

## 12.3. Preconditions
1. The Candidate has a valid authenticated session.
2. A parsing result exists and belongs to the Candidate.
3. The parsing result has not been confirmed or discarded.

## 12.4. Basic Flow
1. The System displays the parsed CV information.
2. The System identifies fields with low parsing confidence.
3. The Candidate reviews personal information, skills, education, and work experience.
4. The Candidate corrects inaccurate or incomplete values.
5. The Candidate selects how confirmed information should be merged with the existing profile.
6. The Candidate selects **Confirm and update profile**.
7. The System validates the reviewed information.
8. The System checks that the candidate profile has not been modified concurrently.
9. The System saves the confirmed information to the candidate profile.
10. The System marks the parsing result as confirmed.
11. The System recalculates profile completion.
12. The System displays the updated candidate profile.

## 12.5. Alternative Flows
### 12.5.1. AF-01 — Required Parsed Information Is Missing
The System identifies missing required fields and asks the Candidate to complete them.

### 12.5.2. AF-02 — Candidate Removes an Incorrect Parsed Entry
The Candidate removes the entry, and the System excludes it from the confirmed profile update.

### 12.5.3. AF-03 — Candidate Keeps Existing Profile Information
When a conflict exists, the Candidate selects the stored profile value instead of the parsed value.

### 12.5.4. AF-04 — Candidate Replaces Existing Information
When a conflict exists, the Candidate selects the parsed value to replace the stored value.

### 12.5.5. AF-05 — Candidate Discards the Parsing Result
The System requests confirmation, marks the result as discarded, and leaves the candidate profile unchanged.

### 12.5.6. AF-06 — Candidate Returns Later
The System saves the parsing result as an unconfirmed draft and displays it when the Candidate returns.

### 12.5.7. AF-07 — Candidate Profile Changed Concurrently
The System displays the latest profile values and requires the Candidate to resolve conflicts again.

### 12.5.8. EF-01 — Confirmed Information Cannot Be Saved
The System keeps the parsing result unconfirmed, preserves the previous profile, and displays a retry message.

## 12.6. Postconditions
- On success, confirmed parsed information is merged into the candidate profile.
- The parsing result is marked as confirmed.
- On discard, the candidate profile remains unchanged.
- On failure, no partial profile merge is reported as successful.

## 12.7. Special Requirements
- Parsed data must never be treated as verified solely because it was produced by the parsing service.
- Low-confidence fields must be visually distinguishable.
- Confirmation and profile update must be performed atomically.
- Only the owning Candidate may review the parsing result.