# DGM-07 — Use-Case Specification: Administrator Data Backup

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*  
**Version:** V1.0 (2026-08-26) — Created for PA5 Final Document Synchronization

### Revision History

| Version | Date | Author/Editor | Summary | Status |
|---|---|---|---|---|
| 1.0 | 2026-08-26 | Nguyễn Minh Khôi | Created complete use-case specifications for Manual Database Backup, Automated Schedule/Retention, Backup History, and Failure Alerting (Feature 026). Clarified step-up 2FA gate and absence of in-app restore UI. | Approved |

The Mermaid source is maintained in [diagram_07.md](../diagrams/diagram_07.md). Platform Administrator interacts with Backup Management subject to step-up authentication.

---

# UC-BKP-01 — Trigger Manual Database Backup

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-BKP-01 |
| Primary Actor | Platform Administrator |
| Supporting Actor | Admin Backup Worker / Runner, Google Drive Storage Provider (Optional) |
| Trigger | The administrator clicks "Trigger Manual Backup" in the Admin Backup Console (`/admin-console/backup`). |

## Brief Description

This use case allows a Platform Administrator with recent two-factor authentication (Step-Up 2FA) to initiate an immediate full database backup. The system generates a compressed, AES-256-GCM encrypted PostgreSQL dump, stores it locally, and optionally uploads the encrypted dump to configured Google Drive storage via OAuth2.

## Actors

- Platform Administrator
- Admin Backup Worker / Runner
- Google Drive Storage Provider (Optional)

## Preconditions

### Active Admin Session with Recent 2FA
The user holds an authenticated `ADMIN` session and has successfully re-verified their two-factor authentication code (TOTP/backup code) within the last 10 minutes (Step-Up 2FA).

## Flow of Events

### Basic Flow — Execute Manual Backup

1. The use case begins when the Administrator navigates to `/admin-console/backup` and clicks "Trigger Backup".
2. The System verifies the Administrator's session and recent 2FA step-up timestamp.
3. The System creates a new `BackupRun` record with status `In_Progress` and trigger type `Manual`.
4. The Backup Runner spawns `pg_dump` to extract PostgreSQL schema and data tables into a gzip-compressed stream.
5. The Backup Runner encrypts the dump stream using AES-256-GCM with the master encryption key (`BACKUP_ENCRYPTION_KEY`).
6. The Backup Runner writes the encrypted artifact to local private storage (`Local Backup Store`).
7. If Google Drive integration is configured and enabled, the Backup Runner uploads the encrypted file to the designated Google Drive folder using OAuth2.
8. The Backup Runner calculates the SHA-256 checksum and file size, updates the `BackupRun` status to `Success`, records completion time, and logs the action to the audit log.
9. The System displays a success notification with file metadata and duration on the Admin Console.
10. The use case ends.

## Alternative Flows

### A1 — Step-Up 2FA Challenge Required
1. At Basic Flow step 2, if the Administrator has not completed a 2FA verification within the past 10 minutes:
2. The System renders a modal prompting for the current TOTP 2FA code.
3. The Administrator enters the 6-digit code.
4. The System verifies the code via Better Auth, updates the step-up timestamp, and resumes at Basic Flow step 3.

## Exception Flows

### E1 — Backup Runner Process Failure
1. At Basic Flow step 4 or 5, if `pg_dump` fails (e.g. disk full, lock timeout, database unreachable):
2. The Backup Runner catches the error, deletes partial ephemeral dump files, updates `BackupRun` status to `Failed`, and records error diagnostics.
3. The System triggers **UC-BKP-04 — Handle Backup Failure and Alerting**.
4. The use case ends.

### E2 — Google Drive Upload Failure
1. At Basic Flow step 7, if Google Drive upload fails (e.g. expired OAuth token, quota exceeded):
2. The local encrypted backup remains intact.
3. The `BackupRun` record records `Local_Success_Cloud_Failed` status with error details.
4. The System triggers an administrative alert per UC-BKP-04.

## Special Requirements

### Strong Cryptographic Encryption
Every backup dump must be encrypted with AES-256-GCM before writing to persistent disk or transmitting to cloud storage.

### Explicit Scope Boundary (No Restore UI)
There is **strictly no restore UI** in the SmartHire web application. Database restoration must be performed out-of-band by authorized database administrators using verified CLI scripts to prevent catastrophic accidental data loss.

### Auditability
Every backup trigger, checksum, duration, and status change is immutably recorded in the audit log.

## Postconditions

### Success End Condition
An encrypted, validated database dump is safely stored locally and in Google Drive (if enabled); the `BackupRun` record is marked `Success`.

### Failure End Condition
The backup run is recorded as `Failed`; error details are logged and alerts sent.

---

# UC-BKP-02 — Configure Automated Backup Schedule and Retention

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-BKP-02 |
| Primary Actor | Platform Administrator |
| Supporting Actor | None |
| Trigger | The administrator updates backup schedule preferences (`/admin-console/backup/settings`). |

## Brief Description

This use case allows a Platform Administrator to configure automated backup intervals (cron expression / daily / weekly), retention policy (number of backup generations or maximum age in days), target storage destinations (local only, or local + Google Drive), and notification recipients.

## Actors

- Platform Administrator

## Preconditions

### Admin Session with Step-Up 2FA
The Administrator holds an active session and has verified 2FA within 10 minutes.

## Flow of Events

### Basic Flow

1. The Administrator opens Backup Settings (`/admin-console/backup/settings`).
2. The System displays current backup configurations: schedule frequency, retention threshold (e.g. retain 30 days), and cloud sync status.
3. The Administrator updates the schedule (e.g. Daily at 02:00 UTC) and retention period (e.g. 14 days).
4. The Administrator clicks "Save Settings".
5. The System validates the cron expression and retention limits.
6. The System persists the updated `BackupConfiguration` record in PostgreSQL.
7. The System logs the configuration update to the audit log and displays a confirmation.
8. The Admin Worker schedule loop refreshes its internal timers with the new configuration.
9. The use case ends.

## Special Requirements

### Retention Enforcement
When retention limits are reached during scheduled runs, older backups exceeding the retention policy are safely purged from storage, with deletion events logged.

## Postconditions

### Success End Condition
Automated backup schedule and retention policies are saved and applied to background worker loops.

---

# UC-BKP-03 — View Backup Run History and Status

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-BKP-03 |
| Primary Actor | Platform Administrator |
| Supporting Actor | None |
| Trigger | The administrator opens the Backup Run History view (`/admin-console/backup/history`). |

## Brief Description

This use case allows a Platform Administrator to inspect a detailed tabular log of past backup runs, showing execution timestamp, trigger type (Manual / Scheduled), status (Success, Failed, In_Progress), file size, duration, SHA-256 checksum, and destination status (Local, Google Drive).

## Actors

- Platform Administrator

## Preconditions

### Active Admin Role
The User has authenticated with the `ADMIN` role.

## Flow of Events

### Basic Flow

1. The Administrator navigates to `/admin-console/backup/history`.
2. The System queries `BackupRun` records from PostgreSQL ordered by start time descending.
3. The System displays the run table with pagination and status badges.
4. The Administrator selects a specific run to inspect execution logs, checksum, and storage file path.
5. The use case ends.

## Postconditions

### Success End Condition
The Administrator views comprehensive historical backup metrics and verification statuses.

---

# UC-BKP-04 — Handle Backup Failure and Alerting

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-BKP-04 |
| Primary Actor | Admin Backup Worker / Runner |
| Supporting Actor | Email Delivery Service, Platform Administrator |
| Trigger | A manual or scheduled backup execution encounters an error. |

## Brief Description

This use case handles unexpected backup failures (e.g. disk space exhaustion, process crash, database connection error, Google Drive OAuth failure), updating the run state, capturing diagnostic traces, and notifying Platform Administrators via in-app alert and transactional email.

## Actors

- Admin Backup Worker / Runner (Primary)
- Platform Administrator (Notification recipient)
- Email Delivery Service

## Flow of Events

### Basic Flow

1. An error occurs during backup execution (in `UC-BKP-01` or scheduled runner).
2. The Backup Runner catches the exception, terminates orphaned subprocesses, and safely cleans up partial temporary files.
3. The Backup Runner updates the corresponding `BackupRun` record: status = `Failed`, error message = sanitized error summary, finished_at = current timestamp.
4. The Backup Runner writes the failure event and stack trace to system audit logs.
5. The System creates an urgent in-app notification for all active Platform Administrators.
6. The System enqueues an urgent alert email in `EmailOutbox` for the designated administrator email.
7. The use case ends.

## Postconditions

### Success End Condition
The failure is safely handled; partial files are cleaned up; error states are recorded and administrators alerted.
