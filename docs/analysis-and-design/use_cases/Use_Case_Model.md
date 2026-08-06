# SmartHire Use-Case Model

*Version: V1.3 (06/08/2026)*
*Scope: five use-case diagrams and their shared modeling conventions*

## 1. Modeling Conventions

The five diagrams use the same light report theme so that screenshots and exported pages have a white background and readable dark text. Actor generalization always points from the specialized actor to the parent actor. A use-case `«include»` is used only when the included behavior is mandatory and reused in the base use case. A use-case `«extend»` is used only for a conditional or optional behavior with an explicit condition and extension point. Navigation between screens and business workflow steps is documented as Related Use Cases and Entry Points in the specifications.

The Mermaid source for each model is also maintained in `diagrams/diagram_01.md` through `diagrams/diagram_05.md`. The blocks below are synchronized copies for the report model.

## 2. DGM-01 — Identity, Access, and Profile

![DGM-01 — Identity, Access, and Profile](./diagrams/rendered_diagrams/diagram_01.png)

```mermaid
flowchart LR
    VISITOR["Visitor"]
    USER["Authenticated User"]
    CANDIDATE["Candidate"]

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph AUTH_GROUP["Identity and Access"]
            direction TB
            AUTH01(["UC-AUTH-01<br/>Register Account"])
            AUTH02(["UC-AUTH-02<br/>Verify Email Address"])
            AUTH03(["UC-AUTH-03<br/>Log In"])
            AUTH04(["UC-AUTH-04<br/>Log Out and End Session"])
            AUTH05(["UC-AUTH-05<br/>Reset Forgotten Password"])
            AUTH06(["UC-AUTH-06<br/>Change Password"])
            AUTH07(["UC-AUTH-07<br/>Access Protected Account Page"])
            AUTH08(["UC-AUTH-08<br/>Enable and Manage Two-Factor Authentication"])
            AUTH09(["UC-AUTH-09<br/>Complete Two-Factor Verification"])
            AUTH10(["UC-AUTH-10<br/>Review and Revoke Active Sessions"])
            AUTH11(["UC-AUTH-11<br/>Recover Account After Loss of All Factors"])
        end
        subgraph ACCOUNT_GROUP["Account Management"]
            direction TB
            ACC01(["UC-ACC-01<br/>Manage Account Information"])
            ACC02(["UC-ACC-02<br/>Manage Account Preferences"])
        end
        subgraph PROFILE_GROUP["Candidate Profile"]
            direction TB
            PROF01(["UC-PROF-01<br/>Manage Candidate Profile"])
            PROF02(["UC-PROF-02<br/>Upload and Parse CV"])
            PROF03(["UC-PROF-03<br/>Review and Confirm Parsed CV"])
        end
    end

    EMAIL["Email Delivery Service"]
    CVPARSER["CV Parsing Service"]

    VISITOR --- AUTH01
    VISITOR --- AUTH02
    VISITOR --- AUTH03
    VISITOR --- AUTH05
    VISITOR --- AUTH09
    VISITOR --- AUTH11
    USER --- AUTH04
    USER --- AUTH06
    USER --- AUTH07
    USER --- AUTH08
    USER --- AUTH10
    USER --- ACC01
    USER --- ACC02
    CANDIDATE --- PROF01
    CANDIDATE --- PROF02
    CANDIDATE --- PROF03
    AUTH01 --- EMAIL
    AUTH02 --- EMAIL
    AUTH05 --- EMAIL
    AUTH11 --- EMAIL
    PROF02 --- CVPARSER

    AUTH09 -. "«extend»<br/>[2FA enabled; after primary credentials]" .-> AUTH03
    CANDIDATE -. "generalizes" .-> USER

    classDef primaryActor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef authCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;
    classDef accountCase fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033;
    classDef profileCase fill:#faf5ff,stroke:#9333ea,stroke-width:1.5px,color:#172033;
    class VISITOR,USER,CANDIDATE primaryActor;
    class EMAIL,CVPARSER supportingActor;
    class AUTH01,AUTH02,AUTH03,AUTH04,AUTH05,AUTH06,AUTH07,AUTH08,AUTH09,AUTH10,AUTH11 authCase;
    class ACC01,ACC02 accountCase;
    class PROF01,PROF02,PROF03 profileCase;
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style AUTH_GROUP fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    style ACCOUNT_GROUP fill:#f8fafc,stroke:#86efac,stroke-width:1px,color:#172033
    style PROFILE_GROUP fill:#f8fafc,stroke:#d8b4fe,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

Registration and email verification, password recovery and login, profile editing and CV upload, and CV parsing and review are separate user goals. Their sequencing is documented in the DGM-01 specification rather than with workflow arrows.

## 3. DGM-02 — Candidate Job Journey

![DGM-02 — Candidate Job Journey](./diagrams/rendered_diagrams/diagram_02.png)

```mermaid
flowchart LR
    VISITOR["Visitor"]
    USER["Authenticated User"]
    CANDIDATE["Candidate"]

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph DISCOVERY["Job Discovery and Interaction"]
            direction TB
            JOB01(["UC-JOB-01<br/>Browse, Search, and Filter Jobs"])
            JOB02(["UC-JOB-02<br/>View Job Details"])
            JOB03(["UC-JOB-03<br/>Save or Remove Job"])
            JOB04(["UC-JOB-04<br/>Share Job"])
            JOB05(["UC-JOB-05<br/>Report Job Posting"])
        end
        subgraph APPLICATION["Candidate Application Journey"]
            direction TB
            APP01(["UC-APP-01<br/>Apply for a Job"])
            APP02(["UC-APP-02<br/>Track Job Applications"])
            APP03(["UC-APP-03<br/>View Saved Jobs"])
            APP04(["UC-APP-04<br/>View Recommended Jobs"])
        end
    end

    SHARE_SERVICE["External Sharing Application"]
    CANDIDATE -. "generalizes" .-> USER
    VISITOR --- JOB01
    VISITOR --- JOB02
    VISITOR --- JOB04
    USER --- JOB01
    USER --- JOB02
    USER --- JOB03
    USER --- JOB04
    USER --- JOB05
    USER --- APP03
    CANDIDATE --- APP01
    CANDIDATE --- APP02
    CANDIDATE --- APP04
    JOB04 --- SHARE_SERVICE

    classDef primaryActor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef discoveryCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;
    classDef applicationCase fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033;
    class VISITOR,USER,CANDIDATE primaryActor;
    class SHARE_SERVICE supportingActor;
    class JOB01,JOB02,JOB03,JOB04,JOB05 discoveryCase;
    class APP01,APP02,APP03,APP04 applicationCase;
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style DISCOVERY fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    style APPLICATION fill:#f8fafc,stroke:#86efac,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

Selecting a result, applying, saving, sharing, and reporting are independent goals. Their entry points are documented in the DGM-02 specification.

## 4. DGM-03 — Recruiter Operations

![DGM-03 — Recruiter Operations](./diagrams/rendered_diagrams/diagram_03.png)

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

Recruiter, HR Manager, and Company Owner generalize Company Member. UC-PIPE-02 writes the stage change and its history event in one transaction; UC-PIPE-03 is a read-only history query. Posting actions and pipeline navigation are Related Use Cases, not workflow relationships.

## 5. DGM-04 — Company Administration and Moderation

![DGM-04 — Company Administration and Moderation](./diagrams/rendered_diagrams/diagram_04.png)

```mermaid
flowchart LR
    subgraph ACTORS["Actors"]
        direction TB
        AU["Authenticated User"]
        Candidate["Candidate"]
        CompanyMember["Company Member"]
        PlatformAdmin["Platform Administrator"]
        Recruiter["Recruiter"]
        HRManager["HR Manager"]
        CompanyOwner["Company Owner"]
        FileScanner["File Scanning Service"]
    end

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph ORG_UC["Organization and Membership"]
            direction TB
            UC_ORG_01(["UC-ORG-01<br/>Submit Company Verification Request"])
            UC_ORG_02(["UC-ORG-02<br/>Request to Join Existing Company"])
            UC_ORG_03(["UC-ORG-03<br/>Review Company or Membership Request"])
            UC_ORG_04(["UC-ORG-04<br/>Manage Company Memberships and Roles"])
            UC_ORG_05(["UC-ORG-05<br/>Manage Membership Lifecycle"])
        end
        subgraph ACCOUNT_UC["Account and User Management"]
            direction TB
            UC_USER_01(["UC-USER-01<br/>Search and View User Accounts"])
            UC_USER_02(["UC-USER-02<br/>Apply Account Enforcement Action"])
        end
        subgraph MOD_UC["Moderation"]
            direction TB
            UC_MOD_01(["UC-MOD-01<br/>Review Submitted Job Posting"])
            UC_MOD_02(["UC-MOD-02<br/>Approve, Reject, or Request Revision"])
            UC_MOD_03(["UC-MOD-03<br/>Investigate Job Report"])
        end
    end

    AU --- UC_ORG_01
    AU --- UC_ORG_02
    CompanyOwner --- UC_ORG_04
    CompanyOwner --- UC_ORG_05
    CompanyMember --- UC_ORG_05
    PlatformAdmin --- UC_ORG_03
    PlatformAdmin --- UC_USER_01
    PlatformAdmin --- UC_USER_02
    PlatformAdmin --- UC_MOD_01
    PlatformAdmin --- UC_MOD_02
    PlatformAdmin --- UC_MOD_03
    FileScanner --- UC_ORG_01
    Candidate -. "generalizes" .-> AU
    CompanyMember -. "generalizes" .-> AU
    PlatformAdmin -. "generalizes" .-> AU
    Recruiter -. "generalizes" .-> CompanyMember
    HRManager -. "generalizes" .-> CompanyMember
    CompanyOwner -. "generalizes" .-> CompanyMember

    classDef actor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef orgCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;
    classDef accountCase fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033;
    classDef moderationCase fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#172033;
    class AU,Candidate,CompanyMember,PlatformAdmin,Recruiter,HRManager,CompanyOwner actor;
    class FileScanner supportingActor;
    class UC_ORG_01,UC_ORG_02,UC_ORG_03,UC_ORG_04,UC_ORG_05 orgCase;
    class UC_USER_01,UC_USER_02 accountCase;
    class UC_MOD_01,UC_MOD_02,UC_MOD_03 moderationCase;
    style ACTORS fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style ORG_UC fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    style ACCOUNT_UC fill:#f8fafc,stroke:#86efac,stroke-width:1px,color:#172033
    style MOD_UC fill:#f8fafc,stroke:#fdba74,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

Candidate, Company Member, and Platform Administrator generalize Authenticated User. Recruiter, HR Manager, and Company Owner generalize Company Member. Account review and enforcement, and posting review and decision, are Related Use Cases rather than workflow extensions.

## 6. DGM-05 — Supporting Services and Analytics

![DGM-05 — Supporting Services and Analytics](./diagrams/rendered_diagrams/diagram_05.png)

```mermaid
flowchart TB
    sys["System / AI Service"]
    auth_user["Authenticated User"]
    cand["Candidate"]
    cm["Company Member<br/>(Authorized)"]
    rec["Recruiter<br/>(Authorized)"]
    admin["Platform Administrator"]

    subgraph SYSTEM["SmartHire Recruitment Platform"]
        direction TB
        subgraph SCREENING["Screening"]
            direction TB
            UC_SCR_01(["UC-SCR-01<br/>Execute Hybrid Candidate Screening"])
            UC_SCR_02(["UC-SCR-02<br/>View Candidate Score and Explanation"])
            UC_SCR_04(["UC-SCR-04<br/>Retry Failed Scoring"])
        end
        subgraph NOTIFICATIONS["Notifications"]
            direction TB
            UC_NOT_01(["UC-NOT-01<br/>Receive Event Notification"])
            UC_NOT_02(["UC-NOT-02<br/>Manage In-App Notifications"])
            UC_NOT_03(["UC-NOT-03<br/>Retry Failed Notification Delivery"])
        end
        subgraph ANALYTICS["Analytics"]
            direction TB
            UC_ANL_01(["UC-ANL-01<br/>View Company Recruitment Analytics"])
            UC_ANL_02(["UC-ANL-02<br/>View Platform Analytics"])
            UC_ANL_03(["UC-ANL-03<br/>Export Authorized Data"])
        end
    end

    cand -. "generalizes" .-> auth_user
    cm -. "generalizes" .-> auth_user
    admin -. "generalizes" .-> auth_user
    rec -. "generalizes" .-> cm
    sys --- UC_SCR_01
    sys --- UC_SCR_04
    sys --- UC_NOT_03
    rec --- UC_SCR_02
    rec --- UC_SCR_04
    cand --- UC_SCR_02
    cand --- UC_NOT_01
    cm --- UC_NOT_01
    cm --- UC_ANL_01
    cm --- UC_ANL_03
    auth_user --- UC_NOT_02
    admin --- UC_ANL_02
    admin --- UC_ANL_03
    UC_SCR_04 -. "«extend»<br/>[screening failed; retry selected]" .-> UC_SCR_01
    UC_ANL_03 -. "«extend»<br/>[Export selected]" .-> UC_ANL_01
    UC_ANL_03 -. "«extend»<br/>[Export selected]" .-> UC_ANL_02

    classDef primaryActor fill:#ffffff,stroke:#334155,stroke-width:1.5px,color:#0f172a;
    classDef supportingActor fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a;
    classDef screeningCase fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#172033;
    classDef notificationCase fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#172033;
    classDef analyticsCase fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#172033;
    class auth_user,cand,cm,rec,admin primaryActor;
    class sys supportingActor;
    class UC_SCR_01,UC_SCR_02,UC_SCR_04 screeningCase;
    class UC_NOT_01,UC_NOT_02,UC_NOT_03 notificationCase;
    class UC_ANL_01,UC_ANL_02,UC_ANL_03 analyticsCase;
    style SYSTEM fill:#ffffff,stroke:#334155,stroke-width:2px,color:#0f172a
    style SCREENING fill:#f8fafc,stroke:#fdba74,stroke-width:1px,color:#172033
    style NOTIFICATIONS fill:#f8fafc,stroke:#93c5fd,stroke-width:1px,color:#172033
    style ANALYTICS fill:#f8fafc,stroke:#86efac,stroke-width:1px,color:#172033
    linkStyle default stroke:#64748b,stroke-width:1.5px,color:#334155
```

UC-SCR-04 is a conditional exception after a failed screening result. UC-NOT-03 is an automated delivery-recovery process related to UC-NOT-01, not an extension of it. UC-ANL-03 is optional export from either analytics view. Candidate and Recruiter views in UC-SCR-02 expose only the data permitted for that actor.

## 7. Cross-Diagram Relationship Index

| Decision | Current representation |
|---|---|
| Actor generalization | Specialized actor → parent actor, using a dashed labeled arrow. |
| DGM-01 two-factor challenge | `UC-AUTH-09 «extend» UC-AUTH-03` only when 2FA is enabled and after primary credentials are validated. |
| DGM-03 posting workflow | UC-POST-01, UC-POST-02, and UC-POST-03 are related goals; no workflow `«extend»`. |
| DGM-03 screening | UC-SCR-03 uses an existing screening result as a precondition; no `«include»` from review to screening. |
| DGM-03 pipeline history | UC-PIPE-02 records one history event atomically; UC-PIPE-03 reads history; no `«include»`. |
| DGM-04 administration | Account review/enforcement and posting review/decision are related goals; no workflow `«extend»`. |
| DGM-05 screening retry | `UC-SCR-04 «extend» UC-SCR-01` only at the failed-result extension point. |
| DGM-05 notification retry | UC-NOT-03 is a separate system recovery process related to UC-NOT-01. |
| DGM-05 analytics export | `UC-ANL-03 «extend» UC-ANL-01/02` only when the actor explicitly selects Export. |
