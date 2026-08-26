# DGM-03 — Recruiter Operations

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

**Version:** V1.5 (2026-08-26) — synchronized with Features 007, 012, 015, and 021; manual-priority screenshot evidence remains pending

## 1. Purpose and scope

This diagram covers company-scoped job-post management, applicant screening/ranking, human priority override, and the nine-stage recruitment Kanban pipeline. AI scoring is advisory: it never hires, rejects, or advances an application. Application-scoped messaging is owned by DGM-05.

## 2. Use-Case Diagram

```mermaid
flowchart LR
    MEMBER["Company Member"]
    REC["Recruiter"]
    HR["HR Manager"]
    OWNER["Company Owner"]
    HM["Hiring Manager"]
    SYSTEM_ACTOR["Scoring Worker / Optional AI Provider"]

    REC -. "generalizes" .-> MEMBER
    HR -. "generalizes" .-> MEMBER
    OWNER -. "generalizes" .-> MEMBER
    HM -. "generalizes" .-> MEMBER

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph POSTING["Job Posting Management"]
            POST01(["UC-POST-01<br/>Create and Manage Job Draft"])
            POST02(["UC-POST-02<br/>Preview and Submit Job Posting"])
            POST03(["UC-POST-03<br/>Manage Job-Posting Lifecycle"])
            POST04(["UC-POST-04<br/>View Company Job Postings"])
        end
        subgraph SCREENING["Applicant Screening and Ranking"]
            SCR01(["UC-SCR-01<br/>Execute Hybrid Candidate Screening"])
            SCR02(["UC-SCR-02<br/>View Score and Explanation"])
            SCR03(["UC-SCR-03<br/>Review and Rank Applicants"])
            SCR04(["UC-SCR-04<br/>Retry Failed AI Scoring"])
            SCR05(["UC-SCR-05<br/>Set Manual Candidate Priority"])
        end
        subgraph PIPELINE["Recruitment Pipeline"]
            PIPE01(["UC-PIPE-01<br/>View Nine-Stage Kanban Board"])
            PIPE02(["UC-PIPE-02<br/>Update Recruitment Stage"])
            PIPE03(["UC-PIPE-03<br/>View Stage History"])
        end
    end

    REC --- POST01 & POST02 & POST03 & POST04
    HR --- POST01 & POST02 & POST03 & POST04
    OWNER --- POST03 & POST04
    REC --- SCR02 & SCR03 & SCR04 & SCR05
    HR --- SCR02 & SCR03 & SCR04 & SCR05
    OWNER --- SCR02 & SCR03 & SCR04 & SCR05
    HM --- SCR02 & SCR03 & SCR04 & SCR05
    REC --- PIPE01 & PIPE02 & PIPE03
    HR --- PIPE01 & PIPE02 & PIPE03
    OWNER --- PIPE01 & PIPE02 & PIPE03
    HM --- PIPE01 & PIPE02 & PIPE03
    SYSTEM_ACTOR --- SCR01

    SCR04 -. "«extend»<br/>[AI assessment failed; actor requests retry]" .-> SCR01

    classDef actor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a
    classDef supporting fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a
    classDef posting fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033
    classDef screening fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#172033
    classDef pipeline fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033
    class MEMBER,REC,HR,OWNER,HM actor
    class SYSTEM_ACTOR supporting
    class POST01,POST02,POST03,POST04 posting
    class SCR01,SCR02,SCR03,SCR04,SCR05 screening
    class PIPE01,PIPE02,PIPE03 pipeline
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px
    style POSTING fill:#f8fafc,stroke:#93c5fd
    style SCREENING fill:#f8fafc,stroke:#fdba74
    style PIPELINE fill:#f8fafc,stroke:#86efac
```

## 3. Authorization and relationship decisions

- Repository authorization permits active company memberships with `OWNER`, `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER` to manage the recruitment pipeline. Owner is therefore not modeled as read-only in DGM-03.
- Owner read-only behavior is limited to recruitment-message oversight in DGM-05.
- Scoring execution is asynchronous. Deterministic results remain usable when the optional AI assessment fails; retry is a conditional extension and cannot change a recruitment stage by itself.
- Manual priority is a human override of ordering, not an override that fabricates an AI score or makes an automatic hiring decision.
- A stage update and its `ApplicationStageEvent` are committed transactionally. Version conflicts and invalid transitions return an error and require a refresh; no false success is shown.

## 4. Use-case summary and evidence

| Use Case IDs | Features | Primary evidence |
|---|---:|---|
| UC-POST-01–04 | F007 | `web/src/app/recruiter/job-postings/`, `/api/recruiter/job-postings/`, job-post services and tests |
| UC-SCR-01–05 | F012, F015 | `web/src/backend/scoring/`, recruiter candidate UI/routes, scoring tests |
| UC-PIPE-01–03 | F021 | `web/src/app/recruiter/pipeline/`, recruitment-pipeline services/routes/tests, `ApplicationStageEvent` schema |

Features 007, 012, and 015 are **Implemented; verification pending**; F021 is **Implemented and verified** in the final inventory. The existence of automated test source is supporting evidence, not by itself a completed final verification.

## 5. Revision history

| Version | Date | Editor | Exact change | Review |
|---|---|---|---|---|
| V1.3 | 2026-08-06 | Group 9 | Revised UML relationships and prototype presentation. | Group 9 |
| V1.4 | 2026-08-26 | Lưu Chí Hải | Added score explanation, AI retry, human priority, Hiring Manager, nine-stage and conflict semantics; corrected Owner pipeline authority and separated recruitment messaging. | Pending Nguyễn Minh Khôi |
| V1.5 | 2026-08-26 | Lưu Chí Hải | Linked existing score-explanation and retry prototypes and recorded missing UC-SCR-05 manual-priority screenshot evidence. | Pending Nguyễn Minh Khôi |
