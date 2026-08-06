# DGM-04 — Company Administration and Moderation

*Performed by: Group 9 | Reviewed by: Group 9 | Edited by: Group 9*
**Version:** V1.3 (06/08/2026) — UML relationships and report theme revised

## 1. Use-Case Diagram

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

    %% Specialized actors point to their parent actors.
    Candidate -. "generalizes" .-> AU
    CompanyMember -. "generalizes" .-> AU
    PlatformAdmin -. "generalizes" .-> AU
    Recruiter -. "generalizes" .-> CompanyMember
    HRManager -. "generalizes" .-> CompanyMember
    CompanyOwner -. "generalizes" .-> CompanyMember

    %% Account review and enforcement, and posting review and decision,
    %% are Related Use Cases rather than workflow extensions.

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

## 2. Relationship Decisions

- Candidate, Company Member, and Platform Administrator generalize Authenticated User. Recruiter, HR Manager, and Company Owner generalize Company Member.
- UC-USER-01 identifies an account; UC-USER-02 is a separate enforcement goal that may be started after the target account has been selected.
- UC-MOD-01 reviews a posting; UC-MOD-02 records the moderation decision as a related goal after review. Neither pair is modeled as a workflow `«extend»`.
- File Scanning Service is a supporting service for company-verification evidence. A user or other notification recipient is not modeled as an actor unless that party directly interacts with the use case.
