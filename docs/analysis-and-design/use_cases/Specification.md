# SmartHire Final Use-Case Specifications

*Performed by: Lưu Chí Hải, Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Lưu Chí Hải, Nguyễn Minh Khôi*

**Version:** 2.0 (2026-08-26) — PA5 final synchronization

## Canonical specification set

The split specifications below are the canonical PA5 records. They contain the use-case IDs, actors, preconditions, basic/alternative/error flows, postconditions, special requirements, related cases, and only the evidence that genuinely exists. This index replaces the stale duplicate five-domain compilation.

| Domain | Canonical file | Evidence boundary |
|---|---|---|
| DGM-01 — Identity, Access, and Candidate Profile | [01_Identity_Access_Profile.md](specification/01_Identity_Access_Profile.md) | F001 remains **Implemented; verification pending** because BUG-AUTH-06 and BUG-AUTH-08 remain open. |
| DGM-02 — Candidate Job Journey | [02_Candidate_Job_Journey.md](specification/02_Candidate_Job_Journey.md) | Genuine UI evidence is linked for UC-JOB-06 and UC-APP-05–07; F005 remains **In progress**. |
| DGM-03 — Recruiter Operations | [03_Recruiter_Operations.md](specification/03_Recruiter_Operations.md) | Genuine UI evidence includes UC-SCR-05; AI remains advisory. |
| DGM-04 — Company Administration and Moderation | [04_Administration_Moderation.md](specification/04_Administration_Moderation.md) | Company-edit authorization is documented only to the degree supported by routes/services. |
| DGM-05 — Communications and Engagement | [05_Services_Analytics.md](specification/05_Services_Analytics.md) | Genuine UI evidence is linked for captured renderable cases. UC-CON-02 remains pending: no Candidate management/disconnect UI or valid prototype exists. |
| DGM-06 — Analytics, Export, and Platform Administration | [06_Analytics_Platform_Administration.md](specification/06_Analytics_Platform_Administration.md) | Only implemented analytics/export and React Admin console behavior is described; no general audit-log viewer is claimed. |
| DGM-07 — Administrator Data Backup | [07_Admin_Backup.md](specification/07_Admin_Backup.md) | No restore UI is claimed. Backup behavior is limited to current configuration, run, and Google Drive adapter evidence. |

## Shared final-release qualifications

- Feature 027 is **Late Feature / Release Decision Pending** and outside this 001–026 specification baseline.
- A screenshot demonstrates the visible UI state shown, not complete feature verification.
- General messaging uses Socket.IO plus REST recovery. Application-scoped recruitment messaging is REST/refetch and tenant/application scoped.
- Platform Administrator access is platform-scoped through the administrator grant/session mechanism; it is not a company `ADMIN` membership role.

## Revision History

| Version | Date | Exact change | Performed by | Reviewed by |
|---|---|---|---|---|
| 2.0 | 2026-08-26 | Replaced the obsolete duplicate five-domain compilation with the authoritative seven-domain PA5 specification index. | Lưu Chí Hải, Nguyễn Minh Khôi | Lưu Chí Hải |
