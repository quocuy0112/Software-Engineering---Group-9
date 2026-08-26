# DGM-06 — Analytics, Export, and Platform Administration

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*  
**Version:** V1.0 (2026-08-26) — Created for PA5 Final Document Synchronization

### Revision History

| Version | Date | Author/Editor | Summary | Status |
|---|---|---|---|---|
| 1.0 | 2026-08-26 | Nguyễn Minh Khôi | Created dedicated DGM-06 for company recruitment analytics, Excel/CSV export, platform overview metrics, and administrative audit logging (Features 006, 009, 022). | Approved |

## 1. Use-Case Diagram

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

```mermaid
flowchart LR
    subgraph ACTORS["Actors"]
        direction TB
        AU["Authenticated User"]
        CompanyMember["Company Member"]
        Recruiter["Recruiter"]
        HRManager["HR Manager"]
        CompanyOwner["Company Owner"]
        PlatformAdmin["Platform Administrator"]
        ExportWorker["Analytics Export Worker"]
    end

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph COMPANY_ANL["Company Recruitment Analytics & Export"]
            direction TB
            UC_ANL_01(["UC-ANL-01<br/>View Company Recruitment Analytics"])
            UC_ANL_02(["UC-ANL-02<br/>Request and Download Recruitment Data Export"])
        end

        subgraph PLATFORM_ADMIN["Platform Administration & Audit"]
            direction TB
            UC_ANL_03(["UC-ANL-03<br/>View Platform-Wide Overview Analytics"])
            UC_ADM_01(["UC-ADM-01<br/>View Platform Audit and System Activity Logs"])
        end
    end

    %% Actor associations
    CompanyOwner --- UC_ANL_01
    CompanyOwner --- UC_ANL_02
    HRManager --- UC_ANL_01
    HRManager --- UC_ANL_02
    Recruiter --- UC_ANL_01

    PlatformAdmin --- UC_ANL_03
    PlatformAdmin --- UC_ADM_01

    ExportWorker --- UC_ANL_02

    %% Actor Generalization
    CompanyMember -. "generalizes" .-> AU
    PlatformAdmin -. "generalizes" .-> AU
    Recruiter -. "generalizes" .-> CompanyMember
    HRManager -. "generalizes" .-> CompanyMember
    CompanyOwner -. "generalizes" .-> CompanyMember

    classDef actor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef anlCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;
    classDef admCase fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033;

    class AU,CompanyMember,Recruiter,HRManager,CompanyOwner,PlatformAdmin actor;
    class ExportWorker supportingActor;
    class UC_ANL_01,UC_ANL_02 anlCase;
    class UC_ANL_03,UC_ADM_01 admCase;

    style ACTORS fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style COMPANY_ANL fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    style PLATFORM_ADMIN fill:#f8fafc,stroke:#86efac,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

## 2. Relationship Decisions

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

- `UC-ANL-01` and `UC-ANL-02` are strictly company-scoped. Only authorized company members (`Company Owner`, `HR Manager`, and `Recruiter` for analytics; `Company Owner` and `HR Manager` for data export) may access company metrics and applicant export data.
- `UC-ANL-03` and `UC-ADM-01` are platform-wide and strictly restricted to `Platform Administrator`.
- `Analytics Export Worker` serves as a background supporting service that claims export tasks and writes generated Excel/CSV files to ephemeral storage.
