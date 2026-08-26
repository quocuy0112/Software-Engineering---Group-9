# DGM-07 — Administrator Data Backup

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi, Lưu Chí Hải*

```mermaid
flowchart LR
  ADMIN["Platform Administrator<br/>(recent 2FA proof required where enforced)"]
  RUNNER["Admin Backup Process"]
  DRIVE["Google Drive Backup Adapter"]
  subgraph SMART["SmartHire Recruitment Platform"]
    BKP1(["UC-BKP-01<br/>Trigger Manual Backup"])
    BKP2(["UC-BKP-02<br/>Configure Backup Enablement and Interval"])
    BKP3(["UC-BKP-03<br/>View Backup Run History"])
    BKP4(["UC-BKP-04<br/>Review Failed Backup Run"])
  end
  ADMIN --- BKP1
  ADMIN --- BKP2
  ADMIN --- BKP3
  ADMIN --- BKP4
  RUNNER --- BKP1
  RUNNER --- BKP4
  DRIVE --- BKP1
```

## Scope and evidence

- The implemented admin backup UI is a resource within `/admin-console`, not separate backup/settings/history pages.
- Recent administrator step-up proof is 15 minutes where required.
- Configuration evidence is limited to `enabled` and `intervalSeconds`; no cron/daily/weekly, retention, destination, or notification-recipient setting is claimed.
- Current run states are `QUEUED`, `LEASED`, `SUCCEEDED`, and `FAILED`. The service uploads an encrypted result through the Google Drive adapter and records Drive metadata; no persistent local-backup store or restore UI is claimed.

## Revision History

| Version | Date | Exact change | Performed by | Reviewed by |
|---|---|---|---|---|
| 1.1 | 2026-08-26 | Corrected routes, step-up duration, configuration and run-status claims; retained the no-restore boundary. | Nguyễn Minh Khôi, Lưu Chí Hải | Lưu Chí Hải |
