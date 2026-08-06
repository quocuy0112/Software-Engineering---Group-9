# DGM-02 — Candidate Job Journey

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*
**Version:** V1.3 (06/08/2026) — UML relationships and report theme revised

## 1. Purpose

This use-case diagram describes how visitors, authenticated users, and candidates discover job opportunities and interact with job postings on the SmartHire Recruitment Platform.

Public users may browse, search, filter, view, and share job postings. After authentication, users may save jobs and report inappropriate postings. Candidates may additionally apply for jobs, track submitted applications, and view personalized job recommendations.

## 2. Scope

DGM-02 covers job discovery, job-posting details, saved jobs, job sharing and reporting, application submission, application tracking, and personalized job recommendations. Account registration, login, candidate-profile management, recruiter operations, and job-posting moderation are specified in other diagrams.

## 3. Actor-Naming Convention

Actors are named using singular, role-based nouns. Candidate generalizes Authenticated User and therefore inherits the parent actor's job-discovery capabilities. Navigation between screens is documented as Related Use Cases and Entry Points in the specifications; it is not modeled as `«include»` or `«extend»`.

## 4. Use-Case Diagram

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

    %% Selecting a result, applying, saving, sharing, and reporting are
    %% independent goals. Their entry points are documented in the UC specs.

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

The Visitor actor is not the parent of Authenticated User. It represents the state in which a person interacts with publicly available functions without an authenticated session.

## 7. Use-Case Summary

| Use Case ID | Use Case | Primary Actor | Supporting Actor | Main Objective |
|---|---|---|---|---|
| UC-JOB-01 | Browse, Search, and Filter Jobs | Visitor / Authenticated User | — | Discover active job postings by browsing listings, entering search terms, and applying supported filters or sorting options. |
| UC-JOB-02 | View Job Details | Visitor / Authenticated User | — | View the complete public information of a selected active job posting. |
| UC-JOB-03 | Save or Remove Job | Authenticated User | — | Add a job posting to the user's saved-job collection or remove it from that collection. |
| UC-JOB-04 | Share Job | Visitor / Authenticated User | External Sharing Application | Copy or distribute a public job-posting link through a supported sharing destination. |
| UC-JOB-05 | Report Job Posting | Authenticated User | — | Submit a report when a job posting appears fraudulent, misleading, inappropriate, duplicated, or otherwise in violation of platform policy. |
| UC-APP-01 | Apply for a Job | Candidate | — | Submit a candidate application to an active job posting using confirmed profile and application information. |
| UC-APP-02 | Track Job Applications | Candidate | — | View submitted applications and their current recruitment stages or statuses. |
| UC-APP-03 | View Saved Jobs | Authenticated User | — | View the authenticated user's saved-job collection and continue interacting with saved postings. |
| UC-APP-04 | View Recommended Jobs | Candidate | — | View job postings recommended using the Candidate's confirmed profile and permitted platform data. |

## 8. Related Use Cases and Entry Points

The following are navigational or optional actions, not UML `«include»` or `«extend»` relationships:

- UC-JOB-01 opens UC-JOB-02 when the actor selects a job result.
- UC-JOB-02 may open UC-JOB-03, UC-JOB-04, UC-JOB-05, or UC-APP-01 through actions on the job-detail page.
- UC-APP-03 may open UC-JOB-02 when the actor selects a saved job; UC-JOB-03 may be started from the saved-job list.
- UC-APP-04 may open UC-JOB-02 when the Candidate selects a recommendation.
