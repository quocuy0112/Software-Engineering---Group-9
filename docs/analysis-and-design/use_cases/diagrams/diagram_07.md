# DGM-07 — Administrator Data Backup

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*  
**Version:** V1.0 (2026-08-26) — Created for PA5 Final Document Synchronization

### Revision History

| Version | Date | Author/Editor | Summary | Status |
|---|---|---|---|---|
| 1.0 | 2026-08-26 | Nguyễn Minh Khôi | Created dedicated DGM-07 for privileged database backup, scheduled runs, history logging, and step-up 2FA (Feature 026). Explicitly noted absence of in-app restore UI. | Approved |

## 1. Use-Case Diagram

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

```mermaid
flowchart LR
    subgraph ACTORS["Actors"]
        direction TB
        PlatformAdmin["Platform Administrator\n(Requires Recent 2FA)"]
        BackupProcess["Admin Backup Worker / Runner"]
        DriveProvider["Google Drive Storage Provider\n(Optional OAuth2)"]
    end

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph BACKUP_MGMT["Database Backup Management"]
            direction TB
            UC_BKP_01(["UC-BKP-01<br/>Trigger Manual Database Backup"])
            UC_BKP_02(["UC-BKP-02<br/>Configure Automated Backup Schedule and Retention"])
            UC_BKP_03(["UC-BKP-03<br/>View Backup Run History and Status"])
            UC_BKP_04(["UC-BKP-04<br/>Handle Backup Failure and Alerting"])
        end
    end

    %% Actor associations
    PlatformAdmin --- UC_BKP_01
    PlatformAdmin --- UC_BKP_02
    PlatformAdmin --- UC_BKP_03

    BackupProcess --- UC_BKP_01
    BackupProcess --- UC_BKP_02
    BackupProcess --- UC_BKP_04

    DriveProvider --- UC_BKP_01
    DriveProvider --- UC_BKP_02

    classDef actor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef backupCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;

    class PlatformAdmin actor;
    class BackupProcess,DriveProvider supportingActor;
    class UC_BKP_01,UC_BKP_02,UC_BKP_03,UC_BKP_04 backupCase;

    style ACTORS fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style BACKUP_MGMT fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

## 2. Relationship Decisions

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

- `Platform Administrator` must satisfy a **Step-Up 2FA requirement** (recent 2FA verification within 10 minutes) before initiating a manual backup or modifying automated schedule settings.
- `UC-BKP-01`, `UC-BKP-02`, `UC-BKP-03`, and `UC-BKP-04` encompass the entire administrative backup domain.
- **Explicit Scope Boundary:** There is **no in-app database restore UI**. Database restoration is an out-of-band disaster-recovery operation executed directly by authorized DBAs via PostgreSQL CLI tools to protect data integrity and prevent destructive overwrites.
