### 1. C4 Level 3 - Frontend Component Diagram

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

```mermaid
flowchart TD
    %% Styling
    classDef component fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef backend fill:#666666,stroke:#444444,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef boundary fill:none,stroke:#444,stroke-width:2px,stroke-dasharray: 5 5,color:#333
    classDef containerBoundary fill:none,stroke:#1168bd,stroke-width:3px,stroke-dasharray: 5 5,color:#1168bd

    %% Frontend Container Boundary
    subgraph Container_Frontend ["Next.js Web Application [Container]"]
        
        %% Candidate Profile Management Boundary
        subgraph Boundary_Profile ["Candidate Profile Management"]
            C_Profile["<b>Profile Overview UI</b><br/>[Component: React/Next.js]<br/><br/>Displays and manages professional<br/>profile data (skills, experience)"]:::component
            C_Account["<b>Account Identity UI</b><br/>[Component: React/Next.js]<br/><br/>Manages account name<br/>and email change requests"]:::component
            C_Security["<b>Security & Prefs UI</b><br/>[Component: React/Next.js]<br/><br/>Manages passwords, 2FA,<br/>and notification settings"]:::component
            C_CV["<b>CV Import Workspace UI</b><br/>[Component: React/Next.js]<br/><br/>Uploads CVs and tracks<br/>parsing status/history"]:::component
        end

        %% Job Board & Advanced Search Boundary
        subgraph Boundary_Jobs ["Job Board & Advanced Search"]
            C_Search["<b>Job Discovery UI</b><br/>[Component: React/Next.js]<br/><br/>Displays job listings<br/>and advanced search filters"]:::component
            C_Detail["<b>Job Detail & Actions UI</b><br/>[Component: React/Next.js]<br/><br/>Shows job details, handles<br/>save and report actions"]:::component
            C_Apply["<b>Job Application UI</b><br/>[Component: React/Next.js]<br/><br/>Handles CV selection<br/>and application submission"]:::component
        end
        
    end

    %% Backend API (Container Level)
    API["<b>SmartHire Backend</b><br/>[Container: Next.js Server-side Services & API Routes]<br/><br/>Handles business logic,<br/>services and data access"]:::backend

    %% Relationships - Profile
    C_Profile -. "GET, PATCH<br/>/api/account/profile" .-> API
    C_Account -. "PATCH /api/account/identity<br/>POST /api/account/email-change/request" .-> API
    C_Security -. "POST /api/account/password/change<br/>PUT /api/account/preferences" .-> API
    C_CV -. "POST, GET<br/>/api/account/cv-imports" .-> API

    %% Relationships - Jobs
    C_Search -. "Server-side job search<br/>request" .-> API
    C_Detail -. "PUT/DEL saved-jobs<br/>POST reports" .-> API
    C_Apply -. "GET application-form<br/>POST applications" .-> API

    C_Detail -. "Triggers application<br/>form" .-> C_Apply
    
    %% Layout constraints
    class Boundary_Profile,Boundary_Jobs boundary
    class Container_Frontend containerBoundary
```

### 2. System Component Description

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

**Group 1: Candidate Profile Management**

* **Profile Overview UI (`profile-overview.tsx`)**
* **Responsibilities:** Displays the candidate's profile dashboard, including personal information, skills, experience, education, and social links.
* **Backend Interaction:** Fetches initial data via server-side `GetProfileAggregateService`. Client-side interactions send requests to `GET /api/account/profile` and `PATCH /api/account/profile` to save section updates.


* **Account Identity UI (`profile-account-view.tsx`)**
* **Responsibilities:** Provides forms for users to view and update their account name and request email changes.
* **Backend Interaction:** Submits updates to `PATCH /api/account/identity` and initiates email changes via `POST /api/account/email-change/request`.


* **Security & Preferences UI (`profile-security-view.tsx`, `profile-preferences-view.tsx`)**
* **Responsibilities:** Wraps the security and preference settings, allowing users to change passwords, manage 2FA (TOTP), and update notification/timezone preferences.
* **Backend Interaction:** Sends requests to `POST /api/account/password/change`, `/api/identity/two-factor/...` for security, and `PUT /api/account/preferences` for user settings.


* **CV Import Workspace UI (`cv-import-workspace.tsx`)**
* **Responsibilities:** Provides the workspace for uploading CV documents (PDF/DOCX), viewing import history, and polling the real-time status of the CV parsing process.
* **Backend Interaction:** Uploads files to `POST /api/account/cv-imports` and polls status/actions using `GET /api/account/cv-imports/{uploadId}` (including endpoints for retries and consent).



**Group 2: Job Board & Advanced Search**

* **Job Discovery UI (`job-search-form.tsx`)**
* **Responsibilities:** Renders the main job search page, including advanced filtering forms (keyword, location, salary, skills) and displays the list of job cards.
* **Backend Interaction:** Performs server-side queries via `JobDiscoveryService.search(...)`.


* **Job Detail & Actions UI (`job-detail.tsx`, `save-job-action.tsx`, `report-job-dialog.tsx`)**
* **Responsibilities:** Displays comprehensive job details, company information, requirements, and benefits. It also houses interactive actions to save, report, or apply for the job.
* **Backend Interaction:** Fetches data via `JobDiscoveryService.detail(...)`. Saves jobs using `PUT/DELETE /api/saved-jobs/{jobId}` and submits reports via `POST /api/jobs/{jobId}/reports`.


* **Job Application UI (`job-application-form.tsx`)**
* **Responsibilities:** Renders the application submission form, allowing candidates to select an imported CV, answer job-specific questions, and write a cover letter.
* **Backend Interaction:** Retrieves the form template via `GET /api/jobs/{jobId}/application-form` and submits the final application to `POST /api/jobs/{jobId}/applications`.