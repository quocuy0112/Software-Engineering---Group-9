# DGM-02 — Candidate Job Journey

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

**Version:** V1.5 (2026-08-26) — synchronized with Features 003, 005, and 020; PA5 screenshot evidence remains pending for UC-JOB-06 and UC-APP-05–07

## 1. Purpose and scope

This diagram covers public job discovery and the authenticated Candidate journey from search through application tracking. It includes image-assisted search, application withdrawal, offer response, and private pre-application CV matching only where corresponding UI, routes, services, persistence, and tests exist. Feature 005 remains **In progress** because the PA5 live OCR cases linked to `BUG-IMG-02` are still open.

Identity/profile/CV management is in DGM-01; recruiter review and pipeline control are in DGM-03; communication is in DGM-05.

## 2. Use-Case Diagram

```mermaid
flowchart LR
    VISITOR["Visitor"]
    USER["Authenticated User"]
    CANDIDATE["Candidate"]

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph DISCOVERY["Job Discovery"]
            JOB01(["UC-JOB-01<br/>Browse, Search, and Filter Jobs"])
            JOB02(["UC-JOB-02<br/>View Job Details"])
            JOB03(["UC-JOB-03<br/>Save or Remove Job"])
            JOB04(["UC-JOB-04<br/>Share Job"])
            JOB05(["UC-JOB-05<br/>Report Job Posting"])
            JOB06(["UC-JOB-06<br/>Search Jobs from an Image"])
        end
        subgraph APPLICATION["Candidate Application Journey"]
            APP01(["UC-APP-01<br/>Apply for a Job"])
            APP02(["UC-APP-02<br/>Track Job Applications"])
            APP03(["UC-APP-03<br/>View Saved Jobs"])
            APP04(["UC-APP-04<br/>View Recommended Jobs"])
            APP05(["UC-APP-05<br/>Withdraw an Application"])
            APP06(["UC-APP-06<br/>Respond to an Offer"])
            APP07(["UC-APP-07<br/>Run a Private CV Match"])
        end
    end

    SHARE["External Sharing Application"]

    CANDIDATE -. "generalizes" .-> USER
    VISITOR --- JOB01
    VISITOR --- JOB02
    VISITOR --- JOB04
    VISITOR --- JOB06
    USER --- JOB01
    USER --- JOB02
    USER --- JOB03
    USER --- JOB04
    USER --- JOB05
    USER --- APP03
    CANDIDATE --- APP01
    CANDIDATE --- APP02
    CANDIDATE --- APP04
    CANDIDATE --- APP05
    CANDIDATE --- APP06
    CANDIDATE --- APP07
    JOB04 --- SHARE

    classDef actor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a
    classDef supporting fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a
    classDef discovery fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033
    classDef application fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033
    class VISITOR,USER,CANDIDATE actor
    class SHARE supporting
    class JOB01,JOB02,JOB03,JOB04,JOB05,JOB06 discovery
    class APP01,APP02,APP03,APP04,APP05,APP06,APP07 application
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style DISCOVERY fill:#f8fafc,stroke:#93c5fd,color:#172033
    style APPLICATION fill:#f8fafc,stroke:#86efac,color:#172033
```

## 3. Actor and use-case summary

| Actor | Meaning |
|---|---|
| Visitor | Unauthenticated person using public job discovery. |
| Authenticated User | Account holder who may save/report jobs and view saved jobs. |
| Candidate | Authenticated User using candidate-only application and private-match functions. |
| External Sharing Application | Optional destination used to distribute a public job URL. |

| Use Case ID | Name | Feature | Implementation status |
|---|---|---:|---|
| UC-JOB-01 | Browse, Search, and Filter Jobs | F003 | Implemented and verified |
| UC-JOB-02 | View Job Details | F003 | Implemented and verified |
| UC-JOB-03 | Save or Remove Job | F003 | Implemented and verified |
| UC-JOB-04 | Share Job | F003 | Implemented and verified |
| UC-JOB-05 | Report Job Posting | F003 | Implemented and verified |
| UC-JOB-06 | Search Jobs from an Image | F005 | In progress — live OCR failure remains open |
| UC-APP-01 | Apply for a Job | F020 | Implemented; verification pending |
| UC-APP-02 | Track Job Applications | F020 | Implemented; verification pending |
| UC-APP-03 | View Saved Jobs | F003 | Implemented and verified |
| UC-APP-04 | View Recommended Jobs | F003 | Implemented and verified |
| UC-APP-05 | Withdraw an Application | F020 | Implemented; verification pending |
| UC-APP-06 | Respond to an Offer | F020 | Implemented; verification pending |
| UC-APP-07 | Run a Private CV Match | F020 | Implemented; verification pending |

## 4. Relationship decisions

- Selecting a result, saving, reporting, applying, withdrawing, responding to an offer, or running a private match are independent user goals, so navigation between them is not modeled as `«include»` or `«extend»`.
- Candidate generalizes Authenticated User. Visitor is a session state, not the parent of Authenticated User.
- Image interpretation may use deterministic fallback after OCR/AI failure; the diagram does not claim that the unresolved live OCR path is verified.

## 5. Repository evidence

- UI: `web/src/app/jobs/`, `web/src/app/jobs/applied/`, `web/src/app/(workspace)/cv-match-check/`, and the corresponding frontend feature directories.
- APIs/services: `web/src/app/api/jobs/image-searches/`, `web/src/app/api/candidate/applications/`, `web/src/app/api/candidate/private-cv-matches/`, `web/src/backend/candidate-applications/`, `web/src/backend/private-cv-match/`, and `web/src/backend/services/image-search/`.
- Data: `JobApplication`, `ApplicationStageEvent`, image-search, private-match, saved-job, and reporting records in `web/prisma/schema.prisma`.
- Verification: candidate-application, private-match, image-search, and job-discovery tests under `web/tests/`; PA5 manual result in `docs/testing/PA5_Testing.md`.

## 6. Revision history

| Version | Date | Editor | Exact change | Review |
|---|---|---|---|---|
| V1.3 | 2026-08-06 | Nguyễn Gia Quốc Uy | Revised UML relationships and report theme. | Group 9 |
| V1.4 | 2026-08-26 | Lưu Chí Hải | Added evidence-backed image search, withdrawal, offer-response, and private-match use cases; recorded F005 failure status and domain boundaries. | Pending Nguyễn Minh Khôi |
| V1.5 | 2026-08-26 | Lưu Chí Hải | Recorded that no matching existing prototype/UI screenshots cover UC-JOB-06 or UC-APP-05–07; specification evidence remains pending. | Pending Nguyễn Minh Khôi |
