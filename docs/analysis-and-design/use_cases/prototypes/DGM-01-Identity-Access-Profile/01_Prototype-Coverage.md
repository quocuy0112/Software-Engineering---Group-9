# DGM-01 — Identity, Access, and Profile Prototype Coverage

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*  
**Version:** V1.0 (23/7/2026) — Initial prototype coverage

## 1. Scope

This document summarizes the desktop-web prototypes for Diagram 1. The prototypes cover the main user flow and representative alternative or error states for each use case.

## 2. Prototype Coverage

| Use Case | Function | Main Interface | Covered States |
|---|---|---|---|
| UC-AUTH-01 | Register Account | [View](./UC-AUTH-01/UC-AUTH-01-BF-Registration-Form.png) | Registration form and validation |
| UC-AUTH-02 | Verify Email Address | [View](./UC-AUTH-02/UC-AUTH-02-BF-Verification-Success.png) | Verification result and resend cooldown |
| UC-AUTH-03 | Log In | [View](./UC-AUTH-03/UC-AUTH-03-BF-Login.png) | Login and successful redirect |
| UC-AUTH-04 | Log Out and End Session | [View](./UC-AUTH-04/UC-AUTH-04-BF-Logged-Out.png) | Logout and logged-out state |
| UC-AUTH-05 | Recover Password | [View](./UC-AUTH-05/UC-AUTH-05-BF-Recovery-Request.png) | Recovery request and password reset |
| UC-AUTH-06 | Change Password | [View](./UC-AUTH-06/UC-AUTH-06-BF-Change-Password.png) | Change form and validation |
| UC-AUTH-07 | Access Protected Account Page | [View](./UC-AUTH-07/UC-AUTH-07-BF-Protected-Page.png) | Protected page and route status |
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

### UC-AUTH-05 — Recover Password

![Recovery Request](./UC-AUTH-05/UC-AUTH-05-BF-Recovery-Request.png)

![Reset Password](./UC-AUTH-05/UC-AUTH-05-BF-Reset-Password.png)

### UC-AUTH-06 — Change Password

![Change Password](./UC-AUTH-06/UC-AUTH-06-BF-Change-Password.png)

### UC-AUTH-07 — Access Protected Account Page

![Protected Account Page](./UC-AUTH-07/UC-AUTH-07-BF-Protected-Page.png)

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
