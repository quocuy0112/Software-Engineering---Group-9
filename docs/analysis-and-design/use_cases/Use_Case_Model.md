# Summary Use-Case Model for PA3 - Group 9

| Document Metadata | Value |
|---|---|
| Group | 9 |
| Document Owner | Nguyễn Gia Quốc Uy (Student ID: 24127261) |
| Reviewers | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi |
| Last Updated | 2026-07-25 |

## 1. Diagram 1 - Identity, Access, and Profile
**Author of this Part:** Nguyễn Gia Quốc Uy   
**Student ID:** 24127261

```mermaid
flowchart LR
    %% =====================================================
    %% LEFT-SIDE ACTORS
    %% =====================================================

    VISITOR["Visitor"]
    USER["Authenticated User"]
    CANDIDATE["Candidate"]

    %% =====================================================
    %% SYSTEM BOUNDARY
    %% =====================================================

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

    %% =====================================================
    %% RIGHT-SIDE SUPPORTING ACTORS
    %% =====================================================

    EMAIL["Email Delivery Service"]
    CVPARSER["CV Parsing Service"]

    %% =====================================================
    %% VISITOR ASSOCIATIONS
    %% =====================================================

    VISITOR --- AUTH01
    VISITOR --- AUTH02
    VISITOR --- AUTH03
    VISITOR --- AUTH05
    VISITOR --- AUTH09
    VISITOR --- AUTH11

    %% =====================================================
    %% AUTHENTICATED USER ASSOCIATIONS
    %% =====================================================

    USER --- AUTH04
    USER --- AUTH06
    USER --- AUTH07
    USER --- AUTH08
    USER --- AUTH10
    USER --- ACC01
    USER --- ACC02

    %% =====================================================
    %% CANDIDATE ASSOCIATIONS
    %% =====================================================

    CANDIDATE --- PROF01
    CANDIDATE --- PROF02
    CANDIDATE --- PROF03

    %% =====================================================
    %% SUPPORTING-SERVICE ASSOCIATIONS
    %% =====================================================

    AUTH01 --- EMAIL
    AUTH02 --- EMAIL
    AUTH05 --- EMAIL
    AUTH11 --- EMAIL
    PROF02 --- CVPARSER

    %% =====================================================
    %% USE-CASE RELATIONSHIPS
    %% =====================================================

    AUTH01 -. "«include»" .-> AUTH02
    AUTH05 -. "«extend»<br/>[Forgot password]" .-> AUTH03
    AUTH09 -. "«extend»<br/>[2FA is enabled]" .-> AUTH03
    AUTH03 -. "«extend»<br/>[No active session]" .-> AUTH07

    PROF02 -. "«extend»<br/>[Candidate chooses CV upload]" .-> PROF01
    PROF02 -. "«include»" .-> PROF03

    %% =====================================================
    %% ACTOR GENERALIZATION
    %% =====================================================

    CANDIDATE -. "specializes" .-> USER

    %% =====================================================
    %% STYLING
    %% =====================================================

    classDef primaryActor fill:#3F3F3F,stroke:#737373,stroke-width:1.5px,color:#FFFFFF;
    classDef supportingActor fill:#3F3F3F,stroke:#737373,stroke-width:1.5px,color:#FFFFFF;
    classDef useCase fill:#3A3A3A,stroke:#737373,stroke-width:1.5px,color:#FFFFFF;
    classDef authCase fill:#343E55,stroke:#7C9CE8,stroke-width:1.5px,color:#FFFFFF;
    classDef accountCase fill:#35453E,stroke:#79A68F,stroke-width:1.5px,color:#FFFFFF;
    classDef profileCase fill:#493D55,stroke:#A78BC2,stroke-width:1.5px,color:#FFFFFF;

    class VISITOR,USER,CANDIDATE primaryActor;
    class EMAIL,CVPARSER supportingActor;

    class AUTH01,AUTH02,AUTH03,AUTH04,AUTH05,AUTH06,AUTH07,AUTH08,AUTH09,AUTH10,AUTH11 authCase;
    class ACC01,ACC02 accountCase;
    class PROF01,PROF02,PROF03 profileCase;

    style SYSTEM fill:#181818,stroke:#737373,stroke-width:2px,color:#FFFFFF
    style AUTH_GROUP fill:#202020,stroke:#526A9F,stroke-width:1px,color:#DCE7FF
    style ACCOUNT_GROUP fill:#202020,stroke:#5F806F,stroke-width:1px,color:#DDF5E8
    style PROFILE_GROUP fill:#202020,stroke:#846C9C,stroke-width:1px,color:#F0E4FC

    linkStyle default stroke:#BDBDBD,stroke-width:1.5px,color:#FFFFFF
```

## 2. Diagram 2 - Candidate Job Journey
**Author of this Part:** Nguyễn Gia Quốc Uy   
**Student ID:** 24127261

```mermaid
flowchart LR
    %% =====================================================
    %% LEFT-SIDE HUMAN ACTORS
    %% =====================================================

    VISITOR["Visitor"]
    USER["Authenticated User"]
    CANDIDATE["Candidate"]

    %% =====================================================
    %% SYSTEM BOUNDARY
    %% =====================================================

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

    %% =====================================================
    %% RIGHT-SIDE SUPPORTING ACTOR
    %% =====================================================

    SHARE_SERVICE["External Sharing Application"]

    %% =====================================================
    %% ACTOR GENERALIZATION
    %% =====================================================

    CANDIDATE -. "specializes" .-> USER

    %% =====================================================
    %% VISITOR ASSOCIATIONS
    %% =====================================================

    VISITOR --- JOB01
    VISITOR --- JOB02
    VISITOR --- JOB04

    %% =====================================================
    %% AUTHENTICATED USER ASSOCIATIONS
    %% =====================================================

    USER --- JOB01
    USER --- JOB02
    USER --- JOB03
    USER --- JOB04
    USER --- JOB05
    USER --- APP03

    %% =====================================================
    %% CANDIDATE ASSOCIATIONS
    %% =====================================================

    CANDIDATE --- APP01
    CANDIDATE --- APP02
    CANDIDATE --- APP04

    %% =====================================================
    %% SUPPORTING ACTOR ASSOCIATION
    %% =====================================================

    JOB04 --- SHARE_SERVICE

    %% =====================================================
    %% USE-CASE RELATIONSHIPS
    %% =====================================================

    JOB02 -. "«extend»<br/>[job selected]" .-> JOB01

    JOB03 -. "«extend»<br/>[save or remove selected]" .-> JOB02
    JOB04 -. "«extend»<br/>[share selected]" .-> JOB02
    JOB05 -. "«extend»<br/>[report selected]" .-> JOB02
    APP01 -. "«extend»<br/>[apply selected]" .-> JOB02

    JOB02 -. "«extend»<br/>[saved job selected]" .-> APP03
    JOB03 -. "«extend»<br/>[saved job removed]" .-> APP03

    JOB02 -. "«extend»<br/>[recommendation selected]" .-> APP04

    %% =====================================================
    %% STYLING
    %% =====================================================

    classDef primaryActor fill:#3F3F3F,stroke:#737373,stroke-width:1.5px,color:#FFFFFF;
    classDef supportingActor fill:#3F3F3F,stroke:#737373,stroke-width:1.5px,color:#FFFFFF;
    classDef discoveryCase fill:#343E55,stroke:#7C9CE8,stroke-width:1.5px,color:#FFFFFF;
    classDef applicationCase fill:#35453E,stroke:#79A68F,stroke-width:1.5px,color:#FFFFFF;

    class VISITOR,USER,CANDIDATE primaryActor;
    class SHARE_SERVICE supportingActor;

    class JOB01,JOB02,JOB03,JOB04,JOB05 discoveryCase;
    class APP01,APP02,APP03,APP04 applicationCase;

    style SYSTEM fill:#181818,stroke:#737373,stroke-width:2px,color:#FFFFFF
    style DISCOVERY fill:#202020,stroke:#526A9F,stroke-width:1px,color:#DCE7FF
    style APPLICATION fill:#202020,stroke:#5F806F,stroke-width:1px,color:#DDF5E8

    linkStyle default stroke:#BDBDBD,stroke-width:1.5px,color:#FFFFFF
```

## 3. Diagram 3 - Recruiter Operations
**Author of this Part:** Ngô Quốc Tuấn   
**Student ID:** 24127581

```mermaid
---
config:
  theme: neutral
  flowchart:
    defaultRenderer: elk
---
flowchart TB
    %% Actors
    ai["System / AI Service"]
    cm["Company Member\n(Authenticated)"]
    rec["Recruiter\n(Authorized)"]
    hrm["HR Manager\n(Authorized)"]
    own["Company Owner\n(Authorized)"]

    %% Actor Generalization
    cm --> rec
    cm --> hrm
    cm --> own

    %% ================= DOMAIN 1 =================
    subgraph subGraph0["Job Posting Management"]
        direction TB
        UC_POST_01("UC-POST-01: Create and Manage Job Draft")
        UC_POST_02("UC-POST-02: Preview and Submit Job Posting")
        UC_POST_03("UC-POST-03: Manage Job-Posting Lifecycle")
        UC_POST_04("UC-POST-04: View Company Job Postings")
    end

    %% ================= DOMAIN 2 =================
    subgraph subGraph1["Applicant Screening and Ranking"]
        direction TB
        UC_SCR_01("UC-SCR-01: Execute Hybrid Candidate Screening\n(ref. Diagram 5)")
        UC_SCR_03("UC-SCR-03: Review and Rank Applicants")
    end

    %% ================= DOMAIN 3 =================
    subgraph subGraph2["Recruitment Pipeline"]
        direction TB
        UC_PIPE_01("UC-PIPE-01: View Recruitment Pipeline Kanban Board")
        UC_PIPE_02("UC-PIPE-02: Update Candidate Recruitment Stage")
        UC_PIPE_03("UC-PIPE-03: View Application Stage History")
    end

    %% Actor to Use Case Relationships
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

    ai --- UC_SCR_01

    rec --- UC_SCR_03
    hrm --- UC_SCR_03

    rec --- UC_PIPE_01
    rec --- UC_PIPE_02
    rec --- UC_PIPE_03

    hrm --- UC_PIPE_01
    hrm --- UC_PIPE_02
    hrm --- UC_PIPE_03

    own --- UC_PIPE_01
    own --- UC_PIPE_03

    %% Use Case to Use Case Relationships
    UC_POST_02 -. "«extend»" .-> UC_POST_01
    UC_POST_03 -. "«extend»" .-> UC_POST_02

    UC_SCR_03 -. "«include»" .-> UC_SCR_01

    UC_PIPE_02 -. "«extend»" .-> UC_PIPE_01
    UC_PIPE_03 -. "«include»" .-> UC_PIPE_02
```

## 4. Diagram 4 - Company Management and Platform Administration
**Author of this Part:** Nguyễn Minh Khôi   
**Student ID:** 24127066

```mermaid
flowchart LR
    subgraph Actors["Actors"]
        direction TB
        AU["Authenticated User"]

        subgraph AUHierarchy["Authenticated User"]
            direction TB
            Candidate["Candidate"]
            CompanyMember["Company Member"]
            PlatformAdmin["Platform Administrator"]
        end

        subgraph CMHierarchy["Company Member"]
            direction TB
            Recruiter["Recruiter"]
            HRManager["HR Manager"]
            CompanyOwner["Company Owner"]
        end

        FileParser["File Parsing Service"]
    end

    subgraph UseCases["Use Cases"]
        direction TB

        subgraph OrgUC["Organization & Membership"]
            direction TB
            UC_ORG_01["UC-ORG-01<br/>Submit Company Verification Request"]
            UC_ORG_02["UC-ORG-02<br/>Request to Join Existing Company"]
            UC_ORG_03["UC-ORG-03<br/>Review Company or Membership Request"]
            UC_ORG_04["UC-ORG-04<br/>Manage Company Memberships and Roles"]
            UC_ORG_05["UC-ORG-05<br/>Manage Membership Lifecycle"]
        end

        subgraph AccountUC["Account & User Management"]
            direction TB
            UC_USER_01["UC-USER-01<br/>Search and View User Accounts"]
            UC_USER_02["UC-USER-02<br/>Apply Account Enforcement Action"]
        end

        subgraph ModUC["Moderation"]
            direction TB
            UC_MOD_01["UC-MOD-01<br/>Review Submitted Job Posting"]
            UC_MOD_02["UC-MOD-02<br/>Approve, Reject, or Request Revision"]
            UC_MOD_03["UC-MOD-03<br/>Investigate Job Report"]
        end
    end

    AU --> UC_ORG_01
    AU --> UC_ORG_02
    CompanyOwner --> UC_ORG_04
    CompanyOwner --> UC_ORG_05
    CompanyMember --> UC_ORG_05
    PlatformAdmin --> UC_ORG_03
    PlatformAdmin --> UC_USER_01
    PlatformAdmin --> UC_USER_02
    PlatformAdmin --> UC_MOD_01
    PlatformAdmin --> UC_MOD_02
    PlatformAdmin --> UC_MOD_03
    FileParser --> UC_ORG_01

    Candidate -.-> AU
    CompanyMember -.-> AU
    PlatformAdmin -.-> AU
    Recruiter -.-> CompanyMember
    HRManager -.-> CompanyMember
    CompanyOwner -.-> CompanyMember

    UC_USER_02 -.->|extend| UC_USER_01
    UC_MOD_02 -.->|extend| UC_MOD_01

    classDef actor fill:#f7f7f7,stroke:#444,stroke-width:1px,color:#111;
    classDef usecase fill:#eef6ff,stroke:#2d6cdf,stroke-width:1px,color:#123;

    class AU,Candidate,CompanyMember,PlatformAdmin,Recruiter,HRManager,CompanyOwner,FileParser actor;
    class UC_ORG_01,UC_ORG_02,UC_ORG_03,UC_ORG_04,UC_ORG_05,UC_USER_01,UC_USER_02,UC_MOD_01,UC_MOD_02,UC_MOD_03 usecase;
```

## 5. Diagram 5 - Supporting Services and Analytics

**Author of this Part:** Lưu Chí Hải   
**Student ID:** 24127030

```mermaid
flowchart TB
    %% Actors
    sys["System / AI Service"]
    auth_user["Authenticated User"]
    cand["Candidate"]
    cm["Company Member\n(Authorized)"]
    rec["Recruiter\n(Authorized)"]
    admin["Platform Administrator"]

    %% Actor Generalization
    auth_user --> cand
    auth_user --> cm
    auth_user --> admin
    cm --> rec

    %% System Boundary
    subgraph subGraph0["Diagram 5 - Screening, Notifications and Analytics"]
        direction TB
        UC_SCR_01("UC-SCR-01: Execute Hybrid Candidate Screening")
        UC_SCR_02("UC-SCR-02: View Candidate Score and Explanation")
        UC_SCR_04("UC-SCR-04: Retry Failed Scoring")
        UC_NOT_01("UC-NOT-01: Receive Event Notification")
        UC_NOT_02("UC-NOT-02: Manage In-App Notifications")
        UC_NOT_03("UC-NOT-03: Retry Failed Notification Delivery")
        UC_ANL_01("UC-ANL-01: View Company Recruitment Analytics")
        UC_ANL_02("UC-ANL-02: View Platform Analytics")
        UC_ANL_03("UC-ANL-03: Export Authorized Data")
    end

    %% Actor to Use Case Relationships
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

    %% Use Case to Use Case Relationships (Extend)
    UC_SCR_04 -. "«extend»" .-> UC_SCR_01
    UC_NOT_03 -. "«extend»" .-> UC_NOT_01
    UC_ANL_03 -. "«extend»" .-> UC_ANL_01
    UC_ANL_03 -. "«extend»" .-> UC_ANL_02
```