# DGM-06 — Analytics, Export, and Platform Administration

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi, Lưu Chí Hải*

**Mermaid source:** [diagram_06.md](../diagrams/diagram_06.md)

## UC-ANL-01 — View Company Recruitment Analytics

**Actors:** Recruiter, HR Manager, Company Owner.

**Preconditions:** The actor has an active membership in the selected company and the requested analytics scope is authorized.

**Basic flow:** The actor opens the recruiter analytics UI; the system resolves company-scoped aggregates and renders the available recruitment metrics.

**Alternative/error flows:** An unauthorized company/job scope is denied without exposing another tenant’s data. Empty/insufficient data renders the implemented empty state.

**Postconditions:** No business data changes.

**Special requirements:** Company filtering is authoritative; any performance figures are acceptance targets, not verified PA5 measurements.

## UC-ANL-02 — Request and Download Recruitment Export

**Actors:** HR Manager, Company Owner; Analytics Export Worker.

**Preconditions:** The actor has an active, authorized company membership and selects an implemented export scope/format.

**Basic flow:** The actor requests CSV or Excel export; the system creates an `ExportRequest`; the worker claims it and generates the authorized artifact; the authorized actor downloads the completed export.

**Alternative/error flows:** The request may remain `QUEUED`/`LEASED`, fail as `FAILED`, expire as `EXPIRED`, or progress through `DELETING`/`DELETED`; the UI must not claim a completed download before the worker succeeds.

**Postconditions:** An authorized export request is recorded and, on success, the generated artifact is available according to the implementation’s configured lifecycle.

**Special requirements:** Do not claim a fixed record limit, duration, local-only artifact store, or retention period without separate execution/configuration evidence.

## UC-ANL-03 — View Platform Overview Analytics

**Actors:** Platform Administrator.

**Preconditions:** The actor has an active `PlatformAdministratorGrant` and designated administrator session/scopes.

**Basic flow:** The actor enters the React Admin console; the console requests the implemented platform overview endpoint and renders the returned aggregate metrics.

**Alternative/error flows:** Missing grant/session scope produces the implemented authorization result; unavailable metrics render the implementation’s error/empty state.

**Postconditions:** No business data changes.

**Special requirements:** This use case does not imply a general audit-log browsing UI. Platform authority is not a company `ADMIN` membership role.

## Revision History

| Version | Date | Exact change | Performed by | Reviewed by |
|---|---|---|---|---|
| 1.1 | 2026-08-26 | Removed unsupported audit-log routes/claims and normalized export states and administrator authority. | Nguyễn Minh Khôi, Lưu Chí Hải | Lưu Chí Hải |
