# PA5 Changes

*Performed by: Lưu Chí Hải, Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Lưu Chí Hải, Nguyễn Minh Khôi*

This log records the PA5 source-document synchronization. It does not turn a specification, screenshot, or test file into implementation proof.

| Revision | Date | Document/Section | Exact change | SpecKit IDs | Code/Test evidence | Reason | Performed by | Reviewed by | Edited by |
|---|---|---|---|---|---|---|---|---|---|
| PA5-R01 | 2026-08-26 | Vision Document | Aligned the product/actor taxonomy, seven final functional domains, FR traceability, NFR/scope/AI qualifications, 15-minute administrator step-up boundary, and Feature 027 exclusion. | F001–F026; F027 pending | Vision traceability, schema/routes/services, PA5 testing report | Remove PA1/PA4-era contradictions. | Lưu Chí Hải, Nguyễn Minh Khôi | Lưu Chí Hải | Lưu Chí Hải, Nguyễn Minh Khôi |
| PA5-R02 | 2026-08-26 | Use-Case Model | Replaced stale duplicate five-domain content with authoritative links to DGM-01–DGM-07 Mermaid sources. | F001–F026 | `diagrams/diagram_01.md`–`diagram_07.md` | One canonical seven-domain model. | Lưu Chí Hải, Nguyễn Minh Khôi | Lưu Chí Hải | Lưu Chí Hải, Nguyễn Minh Khôi |
| PA5-R03 | 2026-08-26 | Use-Case Specifications | Made the split seven-domain specifications authoritative; retained genuine UI evidence and recorded UC-CON-02 as an unrendered Candidate-UI evidence gap. | F001–F026 | UI routes/components, genuine screenshots, tests | Avoid fabricated evidence and duplicate stale specifications. | Lưu Chí Hải, Nguyễn Minh Khôi | Lưu Chí Hải | Lưu Chí Hải, Nguyễn Minh Khôi |
| PA5-R04 | 2026-08-26 | Technology Stack | Evidence handoff identifies actual Compose services and distinguishes them from logical/executable processes; Uy remains edit owner. | F001–F026 | root `compose.yaml`, Dockerfiles, worker scripts | Preserve correct ownership and deployment qualification. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | Lưu Chí Hải |
| PA5-R05 | 2026-08-26 | C4 Level 1 / Frontend | Updated actors, optional adapters, feature boundary, routes/components, and general-vs-recruitment messaging protocol distinction. | F001–F026 | `web/src/app/`, frontend features, `web/server.ts`, `compose.yaml` | Match final frontend/system behavior. | Lưu Chí Hải | Nguyễn Gia Quốc Uy, Nguyễn Quốc Thành | Lưu Chí Hải |
| PA5-R06 | 2026-08-26 | C4 Level 2 / Backend / Deployment | Qualified actual six Compose services, REST recruitment messaging, 15-minute step-up, logical export/backup processes, and Google Drive backup behavior. | F008, F016, F022, F025, F026 | `compose.yaml`, backend services, admin boundary, worker scripts | Remove unsupported infrastructure, Socket.IO, and local-backup claims. | Nguyễn Minh Khôi, Lưu Chí Hải | Lưu Chí Hải | Nguyễn Minh Khôi, Lưu Chí Hải |
| PA5-R07 | 2026-08-26 | Project Plan | Recorded F001–F026 status summary, 50 executed / 43 passed / 7 failed testing evidence, three open medium defects, final-build exit criteria, and outstanding release/package work. | F001–F026 | `docs/testing/PA5_Testing.md`, work plan | Keep Final Build in progress until evidence exists. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | Lưu Chí Hải |
| PA5-R08 | 2026-08-26 | Test Documents | Referenced, but did not rewrite, the authoritative PA5 test plan/results and open-bug evidence. | F001, F005 | `docs/testing/PA5_Testing.md` | Preserve testing ownership while synchronizing final statuses. | Lưu Chí Hải, Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | Lưu Chí Hải, Nguyễn Minh Khôi |

## Remaining truthful gaps

- UC-CON-02 has an accepted-connection API but no Candidate accepted-connection management/disconnect UI or valid prototype evidence.
- F001 remains **Implemented; verification pending** and F005 remains **In progress** under the documented open PA5 defects.
- Feature 027 remains **Late Feature / Release Decision Pending** and outside the F001–F026 baseline.
- Final PDF parity, demo rehearsal, Reflective Report, stabilization, and package audit remain external final-verification work.
