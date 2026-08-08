# C4 Level 1 System Context Diagram — SmartHire

_Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy, Nguyễn Quốc Thành | Edited by: Lưu Chí Hải_

**Architecture scope:** Implemented baseline Features 001–005, including identity and account security, candidate profile/account management, job discovery and application tracking, CV import/review, and purpose-specific OCR with image-assisted job search.

```mermaid
flowchart TD
    %% Standard C4 CSS Formatting
    classDef person fill:#08427b,stroke:#052e56,stroke-width:2px,color:#fff,rx:30px,ry:30px
    classDef system fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef external fill:#999999,stroke:#6b6b6b,stroke-width:2px,color:#fff,rx:8px,ry:8px

    %% Actors Declaration
    V["👤 <b>Visitor</b><br/>[Person]<br/><br/>Browse and search public jobs,<br/>including image-assisted search,<br/>or register an account"]:::person
    C["👤 <b>Candidate</b><br/>[Person]<br/><br/>Manage profile, import CV with OCR,<br/>search/apply for jobs,<br/>and track applications"]:::person

    %% Internal System Declaration
    SH["<b>SmartHire Platform</b><br/>[Software System]<br/><br/>Candidate identity/profile, CV import,<br/>job discovery, application tracking,<br/>and optional AI-assisted processing"]:::system

    %% External Systems Declaration
    EM["<b>Email Delivery Provider</b><br/>[External System — optional]<br/>Resend API or SMTP<br/><br/>Transactional email delivery"]:::external
    ST["<b>AWS S3 & KMS (Adapter)</b><br/>[External System]<br/>S3 + SSE-KMS adapter implemented;<br/>external AWS infrastructure not<br/>provisioned/evidenced"]:::external
    AI["<b>OpenAI Responses API</b><br/>[External System — optional]<br/><br/>Consent-gated CV parsing and<br/>image-search intent interpretation"]:::external
    AV["<b>ClamAV Definition Service</b><br/>[External System]<br/>Freshclam<br/><br/>Malware signature updates<br/>for internal scanner"]:::external

    %% Communication Flow
    V -. "Browse/search jobs, use image-assisted<br/>search, and register [HTTPS]" .-> SH
    C -. "Manage profile, import/review CV,<br/>search, apply, and track [HTTPS]" .-> SH

    SH -. "Send transactional message<br/>[HTTPS or SMTP]" .-> EM
    SH -. "Read/write artifacts & preflight checks<br/>[AWS API / HTTPS]" .-> ST
    SH -. "Send purpose-limited extracted text<br/>when configuration, privacy gate,<br/>and consent allow [HTTPS/JSON]" .-> AI
    SH -. "Update malware signatures<br/>[HTTPS]" .-> AV
```

### 2. System Context Description

_Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy, Nguyễn Quốc Thành | Edited by: Lưu Chí Hải_

**A. What does each actor use SmartHire for?**

- **Visitor:** Uses the platform to browse, filter, and view public job postings; may use image-assisted search to propose filters; and can register to become a Candidate.
- **Candidate:** Creates and reuses a professional profile, imports PDF/DOCX CVs through native-first extraction and purpose-specific OCR, reviews proposed profile data, searches for suitable jobs, submits applications, and tracks application status.

> **Scope note:** Full **Company Member / Recruiter**, **Platform Administrator**, and **Operator** experiences are excluded because complete actor-facing workflows for job-post management, recruitment pipeline administration, platform monitoring, moderation, and company verification are not part of the implemented Features 001–005 baseline documented here, and may be included in PA5.

**B. What data does SmartHire send to or receive from External Systems?**

- **Email Delivery Provider (Resend API / SMTP):** When a non-capture adapter is configured, the Email Worker sends the minimum recipient and transactional message data required for delivery through the Resend HTTPS API or SMTP. The local default does not call this external system and writes messages to Local Mail Capture instead.
- **AWS S3 & KMS (Adapter):** SmartHire's backend code is programmed to push CV files (PDF/DOCX format) and search artifacts to this storage system using Server-Side Encryption (SSE-KMS).

> **Deployment note:** The S3 + SSE-KMS adapter and preflight checks are implemented, but external AWS infrastructure is not provisioned in this repository. `.env.example` defaults to `filesystem`, and no Terraform or CloudFormation files create the required bucket, KMS key, or IAM role.

- **OpenAI Responses API:** SmartHire optionally sends purpose-limited extracted text only after configuration, privacy, and consent checks. For CV import, the provider can convert extracted CV text into a structured review draft with provenance. For image-assisted job search, it can convert OCR text into evidence-bound filter suggestions. SmartHire does not send a Job Description for a candidate-job scoring operation in these implemented flows, and deterministic job search remains authoritative.
- **ClamAV Definition Service (Freshclam):** SmartHire periodically requests and downloads the latest malware signatures from this service to ensure the internal ClamAV engine is up-to-date before and during the scanning of uploaded documents and images.

**C. What sensitive data requires strict protection?**

- **Candidate Personal Information, CVs, and Search Images:** Includes names, emails, phone numbers, detailed PDF/DOCX CV content, uploaded search images, OCR text, and proposed search intent. Artifacts are stored in private application-encrypted local storage by default, are not exposed through public URLs, and are subject to purpose-specific retention and deletion controls. The implemented S3 adapter can use SSE-KMS if separately provisioned.
- **Login Session Data & Passwords:** Password processing is delegated to Better Auth's server-side password implementation. Opaque session tokens are stored in HttpOnly cookies; production configuration enforces secure cookie behavior and strict cookie prefixes to reduce client-side script access and network interception risk.

> **Scope note:** Company verification documents are outside the implemented Features 001–005 baseline and are therefore not represented as an active data flow.
