# DGM-02 — Candidate Job Journey

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*

## 1. Purpose
This use-case diagram describes how visitors, authenticated users, and candidates discover job opportunities and interact with job postings on the SmartHire Recruitment Platform.

Public users may browse, search, filter, view, and share job postings. After authentication, users may save jobs and report inappropriate postings. Candidates may additionally apply for jobs, track submitted applications, and view personalized job recommendations.

## 2. Scope
DGM-02 covers the following functional areas:
- Job discovery and searching.
- Job-posting details.
- Saved jobs.
- Job sharing and reporting.
- Job application submission.
- Application tracking.
- Personalized job recommendations.

Account registration, login, candidate-profile management, recruiter operations, and job-posting moderation are specified in other diagrams.

## 3. Actor-Naming Convention
Actors are named using singular, role-based nouns.
- Human actors are named according to their role or authentication state.
- External-system actors are named according to the service they provide.
- **Candidate** specializes **Authenticated User** and therefore inherits the parent actor's job-discovery capabilities.
- Personal names, development-team roles, and implementation components are not modeled as actors.


## 4. Use case Diagram
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

## 5. Actor Summary
| Actor ID | Actor Name | Actor Type | Description |
|---|---|---|---|
| ACT-01 | Visitor | Primary human actor | A person who does not currently have an authenticated session. A Visitor may discover, view, and share publicly available job postings. |
| ACT-02 | Authenticated User | Primary human actor | A registered account holder with a valid session. An Authenticated User inherits public job-discovery capabilities and may save jobs, remove saved jobs, report postings, and view saved jobs. |
| ACT-03 | Candidate | Specialized primary human actor | An Authenticated User who uses candidate-specific functions. A Candidate may apply for jobs, track submitted applications, and view personalized job recommendations. |
| ACT-04 | External Sharing Application | Supporting external-system actor | An external email, messaging, social-network, or operating-system sharing application used to distribute a job-posting link. |

## 6. Actor Generalization
| Specialized Actor | Parent Actor | Meaning | 
|---|---|---|
| Candidate | Authenticated User | A Candidate inherits all job-discovery and saved-job capabilities available to an Authenticated User and additionally receives application and recommendation capabilities. |

The **Visitor** actor is not the parent of **Authenticated User**. It represents the state in which a person interacts with publicly available functions without an authenticated session.

## 7. Use-Case Summary
| Use Case ID | Use Case | Primary Actor | Supporting Actor | Main Objective | 
|---|---|---|---|---|
| UC-JOB-01 | Browse, Search, and Filter Jobs | Visitor/Authenticated User | — | Discover active job postings by browsing listings, entering search terms, and applying supported filters or sorting options. | 
| UC-JOB-02 | View Job Details | Visitor/Authenticated User | — | View the complete public information of a selected active job posting. | 
| UC-JOB-03 | Save or Remove Job | Authenticated User | — | Add a job posting to the user’s saved-job collection or remove it from that collection. | 
| UC-JOB-04 | Share Job | Visitor/Authenticated User | External Sharing Application | Copy or distribute a public job-posting link through a supported sharing destination. | 
| UC-JOB-05 | Report Job Posting | Authenticated User | — | Submit a report when a job posting appears fraudulent, misleading, inappropriate, duplicated, or otherwise in violation of platform policy. | 
| UC-APP-01 | Apply for a Job | Candidate | — | Submit a candidate application to an active job posting using confirmed profile and application information. | 
| UC-APP-02 | Track Job Applications | Candidate | — | View submitted applications and their current recruitment stages or statuses. | 
| UC-APP-03 | View Saved Jobs | Authenticated User | — | View the authenticated user’s saved-job collection and continue interacting with saved postings. |
| UC-APP-04 | View Recommended Jobs | Candidate | — | View job postings recommended using the Candidate’s confirmed profile and permitted platform data. | 

## 8. Use-Case Relationship Summary
| Source | Relationship | Target | Condition and Meaning | 
|---|---|---|---|
| UC-JOB-02 — View Job Details | «extend» | UC-JOB-01 — Browse, Search, and Filter Jobs | Job details are displayed when the actor selects a job from the discovery results. |
| UC-JOB-03 — Save or Remove Job | «extend» | UC-JOB-02 — View Job Details | An Authenticated User may save or remove the currently displayed job. | 
| UC-JOB-04 — Share Job | «extend» | UC-JOB-02 — View Job Details | The actor may share the currently displayed public job posting. | 
| UC-JOB-05 — Report Job Posting | «extend» | UC-JOB-02 — View Job Details | An Authenticated User may report the currently displayed posting when a policy concern exists. |
| UC-APP-01 — Apply for a Job | «extend» | UC-JOB-02 — View Job Details | An eligible Candidate may begin an application from an active job-detail page. |
| UC-JOB-02 — View Job Details | «extend» | UC-APP-03 — View Saved Jobs | Job details are displayed when the user selects a posting from the saved-job list. | 
| UC-JOB-03 — Save or Remove Job | «extend» | UC-APP-03 — View Saved Jobs | The user may remove a posting directly from the saved-job list. | 
| UC-JOB-02 — View Job Details | «extend» | UC-APP-04 — View Recommended Jobs | 

Job details are displayed when the Candidate selects a recommended posting.