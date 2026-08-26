# Feature Specification: Administrator Data Backup

**Feature Branch**: `026-admin-data-backup`  
**Created**: 2026-08-21  
**Status**: Draft  
**Input**: Administrator-configured, encrypted PostgreSQL backups uploaded to a dedicated Google Drive folder.

## User Scenarios & Testing

### User Story 1 - Configure and run backups (Priority: P1)

As a Platform Administrator, I want to configure an automatic backup interval and start an immediate backup from Admin Settings so that I can protect SmartHire data during demonstrations.

**Independent Test**: An authorized admin sets a valid interval in seconds, saves it, starts a backup, and sees exactly one corresponding run record.

**Acceptance Scenarios**:

1. **Given** a recent-2FA Platform Administrator, **When** they save an enabled interval of at least 10 seconds, **Then** the setting is persisted and becomes the schedule used by the worker.
2. **Given** an enabled configuration, **When** the administrator selects Run backup now, **Then** an idempotent backup request is recorded and processed without blocking the browser.
3. **Given** a non-administrator or stale step-up proof, **When** they attempt to read or change backup settings or request a run, **Then** no configuration or backup information is disclosed or changed.

---

### User Story 2 - Review backup health (Priority: P1)

As a Platform Administrator, I want to see recent backup results so that I can tell whether SmartHire is protected.

**Independent Test**: Complete and fail controlled backup runs and verify the status, timestamp, size, checksum prefix, and safe error state appear without secrets or database content.

**Acceptance Scenarios**:

1. **Given** completed backup runs, **When** the administrator opens Admin Settings, **Then** the latest successful backup and a reverse-chronological history are visible.
2. **Given** an upload or database-dump failure, **When** the run completes, **Then** the administrator sees a safe retryable failure state and no partial backup is marked successful.

## Edge Cases

- A manual request while a scheduled run is active must not create a second concurrent database dump.
- An invalid interval, missing credential, unavailable Drive destination, or unavailable dump executable must fail safely and retain the previous valid configuration.
- A worker restart must resume scheduling from the stored configuration and never infer success from an orphaned partial file.

## Requirements

### Functional Requirements

- **FR-001**: Only a Platform Administrator with recent two-factor proof may view or change backup settings, request a backup, or view its history.
- **FR-002**: The system must persist enabled state, interval seconds, update actor, and versioned configuration.
- **FR-003**: The minimum demo interval is 10 seconds; the UI must label seconds as demonstration-only scheduling.
- **FR-004**: Each run must create a PostgreSQL logical backup, encrypt it before leaving the application host, upload it to the configured private Google Drive folder, and retain checksum and size metadata.
- **FR-005**: Each run must be either succeeded or failed; incomplete data must never be represented as a usable backup.
- **FR-006**: The system must prevent overlapping backup executions and make repeated manual requests idempotent.
- **FR-007**: Backup configuration changes, requests, successes, and failures must be audited without credentials, database rows, token material, or file content.
- **FR-008**: Google Drive credentials and the encryption key must be server-side secrets, never returned by the API, persisted in application tables, logged, or committed.
- **FR-009**: This version must not restore or overwrite a production database from the admin browser.

### Key Entities

- **Backup Configuration**: Singleton schedule controlled by Platform Administrators.
- **Backup Run**: Immutable lifecycle record for a scheduled or manual attempt and its encrypted Drive artifact metadata.

## Success Criteria

- **SC-001**: An authorized administrator can save a valid schedule and request an immediate backup in under two minutes.
- **SC-002**: Every successful run is visible with a verifiable checksum and completion time within one dashboard refresh.
- **SC-003**: Unauthorized, stale, and invalid requests disclose no backup configuration or artifact metadata.
- **SC-004**: Under the demo environment, a 100 MB database backup completes or reports a clear failure within five minutes.

## Assumptions

- The operator supplies a dedicated Google Drive destination and service credential through deployment secrets.
- Version one covers PostgreSQL only; CV and other external artifacts are a later scope.
- The worker host includes the PostgreSQL client tools required to produce a logical dump.
