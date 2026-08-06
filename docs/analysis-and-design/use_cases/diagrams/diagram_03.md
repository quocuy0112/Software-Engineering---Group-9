# DGM-03 — Recruiter Operations

*Performed by: Group 9 | Reviewed by: Group 9 | Edited by: Group 9*
**Version:** V1.3 (06/08/2026) — UML relationships and report theme revised

## 1. Use-Case Diagram

```mermaid
flowchart LR

    %% =========================
    %% Actors
    %% =========================

    cm["Company Member<br/>(Authenticated)"]

    rec["Recruiter<br/>(Authorized)"]
    hrm["HR Manager<br/>(Authorized)"]
    own["Company Owner<br/>(Authorized)"]

    ai["System / AI Service"]

    rec -. Generalization .-> cm
    hrm -. Generalization .-> cm
    own -. Generalization .-> cm

    %% =========================
    %% System Boundary
    %% =========================

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction LR

        %% ---------------------
        %% Job Posting
        %% ---------------------

        subgraph POSTING["Job Posting Management"]
            direction TB

            UC_POST_01(["UC-POST-01<br/>Create and Manage Job Draft"])

            UC_POST_02(["UC-POST-02<br/>Preview and Submit Job Posting"])

            UC_POST_03(["UC-POST-03<br/>Manage Job-Posting Lifecycle"])

            UC_POST_04(["UC-POST-04<br/>View Company Job Postings"])
        end

        %% ---------------------
        %% Screening
        %% ---------------------

        subgraph SCREENING["Applicant Screening and Ranking"]
            direction TB

            UC_SCR_01(["UC-SCR-01<br/>Execute Hybrid Candidate Screening"])

            UC_SCR_03(["UC-SCR-03<br/>Review and Rank Applicants"])
        end

        %% ---------------------
        %% Pipeline
        %% ---------------------

        subgraph PIPELINE["Recruitment Pipeline"]
            direction TB

            UC_PIPE_01(["UC-PIPE-01<br/>View Recruitment Pipeline Kanban Board"])

            UC_PIPE_02(["UC-PIPE-02<br/>Update Candidate Recruitment Stage"])

            UC_PIPE_03(["UC-PIPE-03<br/>View Application Stage History"])
        end
    end

    %% =========================
    %% Posting
    %% =========================

    rec --- UC_POST_01
    rec --- UC_POST_02
    rec --- UC_POST_03
    rec --- UC_POST_04

    hrm --- UC_POST_01
    hrm --- UC_POST_02
    hrm --- UC_POST_03
    hrm --- UC_POST_04

    own --- UC_POST_03
    own --- UC_POST_04

    %% =========================
    %% Screening
    %% =========================

    ai --- UC_SCR_01

    rec --- UC_SCR_03
    hrm --- UC_SCR_03

    %% =========================
    %% Pipeline
    %% =========================

    rec --- UC_PIPE_01
    rec --- UC_PIPE_02
    rec --- UC_PIPE_03

    hrm --- UC_PIPE_01
    hrm --- UC_PIPE_02
    hrm --- UC_PIPE_03

    own --- UC_PIPE_01
    own --- UC_PIPE_03

    %% =========================
    %% Styles
    %% =========================

    classDef primaryActor fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:2px,color:#0f172a;

    classDef postingCase fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#172033;
    classDef screeningCase fill:#fff7ed,stroke:#ea580c,stroke-width:2px,color:#172033;
    classDef pipelineCase fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#172033;

    class cm,rec,hrm,own primaryActor;
    class ai supportingActor;

    class UC_POST_01,UC_POST_02,UC_POST_03,UC_POST_04 postingCase;
    class UC_SCR_01,UC_SCR_03 screeningCase;
    class UC_PIPE_01,UC_PIPE_02,UC_PIPE_03 pipelineCase;

    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:3px
    style POSTING fill:#f8fafc,stroke:#93c5fd
    style SCREENING fill:#f8fafc,stroke:#fdba74
    style PIPELINE fill:#f8fafc,stroke:#86efac
```

## 2. Relationship Decisions

- Recruiter, HR Manager, and Company Owner generalize Company Member; the arrow points from each specialized actor to its parent.
- UC-POST-01, UC-POST-02, and UC-POST-03 are separate posting goals connected through Related Use Cases and entry conditions, not `«extend»` workflow arrows.
- UC-PIPE-02 writes the stage change and its history event in one transaction. UC-PIPE-03 is a read-only history query and does not include UC-PIPE-02.
- UC-SCR-03 requires an available screening result as a precondition. The screening process is started by the application workflow and is not an `«include»` of applicant review.
