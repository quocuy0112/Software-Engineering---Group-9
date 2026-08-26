# DGM-07 — Administrator Data Backup

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi, Lưu Chí Hải*

**Mermaid source:** [diagram_07.md](../diagrams/diagram_07.md)

## UC-BKP-01 — Trigger Manual Backup

**Actors:** Platform Administrator; Admin Backup Process; Google Drive Backup Adapter.

**Preconditions:** The actor has an active administrator grant/designated session and satisfies the implemented recent-step-up requirement (15 minutes where enforced).

**Basic flow:** From the backup resource in the React Admin console, the administrator requests a run. The system records a run, the backup process creates and encrypts the dump, and the Google Drive adapter uploads it and records resulting Drive metadata.

**Alternative/error flows:** A failed process/upload records `FAILED`; a queued or claimed run remains `QUEUED` or `LEASED` until final outcome.

**Postconditions:** The run is recorded as `SUCCEEDED` or `FAILED` without an in-app restore operation.

## UC-BKP-02 — Configure Backup Enablement and Interval

**Actors:** Platform Administrator.

**Preconditions:** Same administrator and recent-step-up boundary as UC-BKP-01.

**Basic flow:** The administrator updates the supported `enabled` and `intervalSeconds` configuration in the backup resource; the system validates and persists it.

**Alternative/error flows:** Invalid configuration or stale step-up proof is rejected without changing the existing configuration.

**Postconditions:** The current enabled/interval configuration is retained.

## UC-BKP-03 — View Backup Run History

**Actors:** Platform Administrator.

**Preconditions:** Authorized administrator session.

**Basic flow:** The actor opens the backup resource in `/admin-console`; the system returns recorded runs and their current supported statuses.

**Alternative/error flows:** Unauthorized users receive the implemented authorization result.

**Postconditions:** No backup data changes.

## UC-BKP-04 — Review Failed Backup Run

**Actors:** Platform Administrator; Admin Backup Process.

**Preconditions:** A recorded run has status `FAILED`.

**Basic flow:** The administrator reviews the failed run in backup history and may use the implemented manual-run action after resolving the operational cause.

**Alternative/error flows:** The document does not claim automatic backup-specific email/in-app alerts or a retention-purge workflow because repository evidence does not establish them.

**Postconditions:** The prior failed run remains an auditable history entry; any new manual run is separate.

## Scope boundary

There is no in-app restore UI. Restore remains an out-of-band DBA/disaster-recovery operation.

## Revision History

| Version | Date | Exact change | Performed by | Reviewed by |
|---|---|---|---|---|
| 1.1 | 2026-08-26 | Corrected backup UI location, 15-minute step-up boundary, supported states/configuration, and Google Drive upload behavior. | Nguyễn Minh Khôi, Lưu Chí Hải | Lưu Chí Hải |
