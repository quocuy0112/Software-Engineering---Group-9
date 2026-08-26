# SmartHire Final Use-Case Model

*Performed by: Lưu Chí Hải, Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Lưu Chí Hải, Nguyễn Minh Khôi*

**Version:** 2.0 (2026-08-26) — PA5 final synchronization

## Canonical model structure

This index is the canonical PA5 use-case model. The seven linked Mermaid sources are authoritative; their linked split specifications are the authoritative detailed use-case records. This avoids maintaining contradictory duplicate Mermaid and specification copies.

| Diagram | Logical domain | Authoritative Mermaid source | Authoritative specification |
|---|---|---|---|
| DGM-01 | Identity, access, account, candidate profile, and CV | [diagram_01.md](diagrams/diagram_01.md) | [01_Identity_Access_Profile.md](specification/01_Identity_Access_Profile.md) |
| DGM-02 | Candidate job discovery, image search, applications, saved jobs, tracking, offers, and private CV match | [diagram_02.md](diagrams/diagram_02.md) | [02_Candidate_Job_Journey.md](specification/02_Candidate_Job_Journey.md) |
| DGM-03 | Recruiter job posting, screening/scoring, manual priority, and Kanban pipeline | [diagram_03.md](diagrams/diagram_03.md) | [03_Recruiter_Operations.md](specification/03_Recruiter_Operations.md) |
| DGM-04 | Company administration, membership, verification, and moderation | [diagram_04.md](diagrams/diagram_04.md) | [04_Administration_Moderation.md](specification/04_Administration_Moderation.md) |
| DGM-05 | Notifications, professional connections, general messaging, recruitment messaging, and report review | [diagram_05.md](diagrams/diagram_05.md) | [05_Services_Analytics.md](specification/05_Services_Analytics.md) |
| DGM-06 | Company analytics/export and implemented platform-administration overview | [diagram_06.md](diagrams/diagram_06.md) | [06_Analytics_Platform_Administration.md](specification/06_Analytics_Platform_Administration.md) |
| DGM-07 | Platform-administrator backup configuration, runs, and history | [diagram_07.md](diagrams/diagram_07.md) | [07_Admin_Backup.md](specification/07_Admin_Backup.md) |

## Modeling and evidence rules

- Mermaid `.md` files above are authoritative. Rendered images are convenience artifacts only.
- Candidate, Recruiter, HR Manager, Company Owner, and Platform Administrator are distinct roles. Company membership authority is tenant-scoped; Platform Administrator authority is platform-scoped through the administrator grant/session boundary.
- General messaging uses Socket.IO for realtime delivery with REST recovery. Recruitment messaging is application-scoped and uses REST/refetch; it is not a Socket.IO recruitment-thread feature.
- AI scoring is advisory. Recruiter/HR decisions and pipeline transitions remain human actions.
- Feature 027 is **Late Feature / Release Decision Pending** and is excluded from this Feature 001–026 model.
- Real UI/prototype evidence is linked only in the relevant split specification. UC-CON-02 remains an evidence and UI gap: an API exists, but the Candidate UI does not render accepted-connection management or disconnect controls.

## Feature-domain coverage

| Feature range | Primary diagrams |
|---|---|
| F001–F005, F020 | DGM-01, DGM-02 |
| F007, F012, F015, F021 | DGM-03 |
| F006, F009, F014, F017, F018, F023, F024 | DGM-04 |
| F008, F011, F013, F016, F019, F025 | DGM-05 |
| F022 and implemented administrator overview responsibilities | DGM-06 |
| F026 | DGM-07 |

## Revision History

| Version | Date | Exact change | Performed by | Reviewed by |
|---|---|---|---|---|
| 2.0 | 2026-08-26 | Replaced the obsolete duplicate five-diagram copy with the seven-domain PA5 canonical index and authoritative split-source links. | Lưu Chí Hải, Nguyễn Minh Khôi | Lưu Chí Hải |
