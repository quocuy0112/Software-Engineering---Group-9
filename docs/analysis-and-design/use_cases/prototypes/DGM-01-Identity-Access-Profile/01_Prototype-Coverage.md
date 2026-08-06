# DGM-01 — Identity, Access, and Profile Prototype Coverage

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*
**Version:** V1.1 (25/7/2026) — Reconciled with the implemented PA3 identity feature

## 1. Scope

This document summarizes the desktop-web prototypes and implementation evidence for Diagram 1. Conceptual prototypes describe approved future behavior, while implementation captures show the executable PA3 identity feature. Each image must be labelled by evidence type and implementation status so that different visual generations are not presented as one final design system.

### 1.1. Evidence Classification

| Classification | Meaning |
|---|---|
| **Implemented — application capture** | Captured from the executable PA3 Spec Kit functional group. These images use the current green SmartHire public-authentication and authenticated-workspace shells. |
| **Implemented — prototype** | A static prototype for behavior that is also implemented; visual details may predate the current application shell. |
| **Partially implemented** | Only the account-workspace portion is implemented; editing or broader profile behavior remains planned. |
| **Planned — conceptual prototype** | Approved future SmartHire behavior outside the selected PA3 implementation group. The image is not evidence that the feature has been implemented. |

Raw captures containing personal email addresses, live TOTP values, backup codes, or other authentication material must not be submitted. PA3 application captures must use seeded test data, be sanitized, and be cropped to the relevant application interface.

The detailed UC specification embeds the corresponding evidence directly under every UC. This file is an index and status-classification appendix, not the only location where prototype evidence appears.

## 2. Prototype Coverage

| Use Case | Function | Main Interface | Covered States |
|---|---|---|---|
| UC-AUTH-01 | Register Account | [View](./UC-AUTH-01/UC-AUTH-01-BF-Registration-Form.png) | Registration form and validation |
| UC-AUTH-02 | Verify Email Address | [View](./UC-AUTH-02/UC-AUTH-02-BF-Verification-Success.png) | Verification result and resend cooldown |
| UC-AUTH-03 | Log In | [View](./UC-AUTH-03/UC-AUTH-03-BF-Login.png) | Login and successful redirect |
| UC-AUTH-04 | Log Out and End Session | [View](./UC-AUTH-04/UC-AUTH-04-BF-Logged-Out.png) | Logout and logged-out state |
| UC-AUTH-05 | Reset Forgotten Password | [View](./UC-AUTH-05/UC-AUTH-05-BF-Recovery-Request.png) | Normal reset request and password reset; existing TOTP and unused backup codes are preserved |
| UC-AUTH-06 | Change Password | [View](./UC-AUTH-06/UC-AUTH-06-BF-Change-Password.png) | Change form and validation |
| UC-AUTH-07 | Access Protected Account Page | [View](./UC-AUTH-07/UC-AUTH-07-BF-Protected-Page.png) | Protected page and route status |
| UC-AUTH-08 | Enable and Manage Two-Factor Authentication | [View](./UC-AUTH-08/UC-AUTH-08-BF-Enable-Manage-2FA.jpg) | Enrollment, initial proof, backup-code display, enabled management, regeneration, and disablement |
| UC-AUTH-09 | Complete Two-Factor Verification | [View](./UC-AUTH-09/UC-AUTH-09-BF-Complete-2FA.jpg) | Authenticator mode, backup-code mode, failure states, and successful redirect |
| UC-AUTH-10 | Review and Revoke Active Sessions | [View](./UC-AUTH-10/UC-AUTH-10-BF-Review-Session.jpg) | Current-only state, multiple sessions, selected revocation, and revoked reuse |
| UC-AUTH-11 | Recover Account After Loss of All Factors | [View](./UC-AUTH-11/UC-AUTH-11-BF-Recovery-Account-All.jpg) | Request, email confirmation, security hold, cancellation, completion, and failure states |
| UC-ACC-01 | Manage Account Information | [View](./UC-ACC-01/UC-ACC-01-BF-Account-Information.png) | View, edit, and validation |
| UC-ACC-02 | Manage Account Preferences | [View](./UC-ACC-02/S-ACC-PREFERENCES.png) | Preferences and restore defaults |
| UC-PROF-01 | Manage Candidate Profile | [View](./UC-PROF-01/UC-PROF-01-BF-Profile-View.png) | Profile view, editor, and validation |
| UC-PROF-02 | Upload and Parse CV | [View](./UC-PROF-02/UC-PROF-02-BF-CV-Upload.png) | Upload, parsing progress, and failure |
| UC-PROF-03 | Review and Confirm Parsed CV | [View](./UC-PROF-03/UC-PROF-03-BF-Parsed-CV-Review.png) | Review, confirmation, and draft handling |

## 3. Main Interface Images

### UC-AUTH-01 — Register Account

![Registration Form](./UC-AUTH-01/UC-AUTH-01-BF-Registration-Form.png)

### UC-AUTH-02 — Verify Email Address

![Verification Success](./UC-AUTH-02/UC-AUTH-02-BF-Verification-Success.png)

### UC-AUTH-03 — Log In

![Login](./UC-AUTH-03/UC-AUTH-03-BF-Login.png)

![Successful Redirect](./UC-AUTH-03/UC-AUTH-03-BF-Successful-Redirect.png)

### UC-AUTH-04 — Log Out and End Session

![Logged Out](./UC-AUTH-04/UC-AUTH-04-BF-Logged-Out.png)

### UC-AUTH-05 — Reset Forgotten Password

![Recovery Request](./UC-AUTH-05/UC-AUTH-05-BF-Recovery-Request.png)

![Reset Password](./UC-AUTH-05/UC-AUTH-05-BF-Reset-Password.png)

### UC-AUTH-06 — Change Password

![Change Password](./UC-AUTH-06/UC-AUTH-06-BF-Change-Password.png)

### UC-AUTH-07 — Access Protected Account Page

The existing `UC-AUTH-07-BF-Protected-Page.png` displays an access-denied result and must be reclassified as alternative-flow evidence. The successful protected Dashboard application capture is the required basic-flow evidence.

### UC-AUTH-08 — Enable and Manage Two-Factor Authentication

Required application captures:

1. Disabled 2FA state.
2. Current-password proof.
3. QR code and manual setup key.
4. Initial TOTP verification and invalid-code feedback.
5. One-time backup-code display.
6. Enabled management state.
7. Backup-code regeneration confirmation and result.
8. Disable confirmation, invalid proof, and success result.

![Enable and Manage Two-Factor](./UC-AUTH-08/UC-AUTH-08-BF-Enable-Manage-2FA.jpg)

### UC-AUTH-09 — Complete Two-Factor Verification

Required application captures:

1. Authenticator-code mode.
2. Backup-code mode.
3. Invalid or expired factor.
4. Expired challenge and restart-login action.
5. Rate-limited state.
6. Successful verification and Dashboard redirect.

![Complete Two-Factor](./UC-AUTH-09/UC-AUTH-09-BF-Complete-2FA.jpg)

### UC-AUTH-10 — Review and Revoke Active Sessions

Required application captures:

1. Current-session-only state.
2. Multiple-session state with a current-session marker.
3. Revoke action and confirmation.
4. Successful revocation with refreshed list.
5. Already-expired or already-revoked state.
6. Rejected protected access from the revoked session.

![Review Session](./UC-AUTH-10/UC-AUTH-10-BF-Review-Session.jpg)

### UC-AUTH-11 — Recover Account After Loss of All Factors

Required application captures:

1. Recovery request and validation.
2. Check-email state.
3. Invalid, expired, and reused confirmation proof.
4. Security-hold status and blocked login.
5. Cancellation confirmation and terminal cancelled state.
6. Too-early completion result.
7. New-password completion form and validation.
8. Successful completion with normal-login action.
9. Provider or mandatory-step failure without false success.

![Recover Account after all](./UC-AUTH-11/UC-AUTH-11-BF-Recovery-Account-All.jpg)

### UC-ACC-01 — Manage Account Information

![Account Information](./UC-ACC-01/UC-ACC-01-BF-Account-Information.png)

![Edit Account](./UC-ACC-01/UC-ACC-01-BF-Edit-Account.png)

### UC-ACC-02 — Manage Account Preferences

![Account Preferences](./UC-ACC-02/S-ACC-PREFERENCES.png)

### UC-PROF-01 — Manage Candidate Profile

![Profile View](./UC-PROF-01/UC-PROF-01-BF-Profile-View.png)

![Profile Editor](./UC-PROF-01/UC-PROF-01-BF-Profile-Editor.png)

### UC-PROF-02 — Upload and Parse CV

![CV Upload](./UC-PROF-02/UC-PROF-02-BF-CV-Upload.png)

![Parsing Progress](./UC-PROF-02/UC-PROF-02-BF-Parsing-Progress.png)

### UC-PROF-03 — Review and Confirm Parsed CV

![Parsed CV Review](./UC-PROF-03/UC-PROF-03-BF-Parsed-CV-Review.png)

![Confirmation Success](./UC-PROF-03/UC-PROF-03-BF-Confirmation-Success.png)

## 4. Shared Screens

Shared prototypes include the login page, verification-pending page, link-status page, dashboard, and protected-route status page. These screens are reused across related use cases to keep the design consistent.

## 5. Implemented and Planned Scope

| Use Cases | Status for PA3 |
|---|---|
| UC-AUTH-01 through UC-AUTH-11 | Implemented functional group; current green-shell captures are authoritative implementation evidence. |
| UC-ACC-01 | Partially implemented through Profile Overview; general account editing remains represented by a conceptual prototype. |
| UC-ACC-02 | Planned; conceptual prototype only. |
| UC-PROF-01 through UC-PROF-03 | Planned; conceptual prototypes only. The current Profile page intentionally marks professional-profile areas as coming later. |

Visual differences between the blue conceptual prototypes and green application captures are therefore expected, but the two sets must not be presented without these status labels. A later design-system unification may restyle planned prototypes without changing their approved use-case behavior.
