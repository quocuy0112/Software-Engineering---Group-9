### 1. C4 Level 1 - System Context Diagram

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy, Nguyễn Quốc Thành | Edited by: Lưu Chí Hải*

```mermaid
flowchart TD
    %% Standard C4 CSS Formatting
    classDef person fill:#08427b,stroke:#052e56,stroke-width:2px,color:#fff,rx:30px,ry:30px
    classDef system fill:#1168bd,stroke:#0b4884,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef external fill:#999999,stroke:#6b6b6b,stroke-width:2px,color:#fff,rx:8px,ry:8px

    %% Actors Declaration
    V["👤 <b>Visitor</b><br/>[Person]<br/><br/>Browse public jobs<br/>or register an account"]:::person
    C["👤 <b>Candidate</b><br/>[Person]<br/><br/>Manage profile, upload CV,<br/>and track applications"]:::person

    %% Internal System Declaration
    SH["<b>SmartHire Platform</b><br/>[Software System]<br/><br/>AI-assisted ATS helping SMEs<br/>manage recruitment workflows centrally"]:::system

    %% External Systems Declaration
    EM["<b>Email Provider [External System: SMTP]</b><br/>[External System]<br/>Resend API / SMTP<br/><br/>Email delivery service for<br/>notifications and verification"]:::external
    ST["<b>AWS S3 & KMS (Adapter)</b><br/>[External System]<br/>S3 + SSE-KMS adapter implemented;<br/>external AWS infrastructure not<br/>provisioned/evidenced"]:::external
    AI["<b>AI CV Parsing & Scoring Service</b><br/>[External System]<br/>OpenAI API<br/><br/>Semantic analysis and<br/>candidate scoring"]:::external
    AV["<b>ClamAV Definition Service</b><br/>[External System]<br/>Freshclam<br/><br/>Malware signature updates<br/>for internal scanner"]:::external

    %% Communication Flow 
    V -. "View jobs & register" .-> SH
    C -. "Manage profile, search jobs,<br/>upload CV, apply & track" .-> SH

    SH -. "Send payload<br/>[HTTPS/SMTP]" .-> EM
    SH -. "Read/write artifacts & preflight checks<br/>[AWS API / HTTPS]" .-> ST
    SH -. "Send raw text<br/>[HTTPS/JSON]" .-> AI
    SH -. "Update malware signatures<br/>[HTTPS]" .-> AV
```

### 2. System Context Description

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy, Nguyễn Quốc Thành | Edited by: Lưu Chí Hải*

**A. What does each actor use SmartHire for?**

* **Visitor:** Uses the platform to view public job postings and go through the registration flow to become a Candidate.
* **Candidate:** Creates and reuses a professional profile, uploads CVs, searches for suitable jobs, submits applications, and tracks their application status on the system.

> **Note:** The roles **Company Member / Recruiter**, **Platform Administrator**, and **Operator** (along with their corresponding features such as job posting, pipeline management, system monitoring, and company verification) are excluded from this diagram as they reflect the current system implementation (PA1 → PA4). These actors and features are planned for development in **PA5**.

**B. What data does SmartHire send to or receive from External Systems?**

* **Email Provider (Resend API / SMTP):** SmartHire sends payloads containing recipient information and content via SMTP (e.g., using a personal email account) to deliver notifications.
* **AWS S3 & KMS (Adapter):** SmartHire's backend code is programmed to push CV files (PDF/DOCX format) and search artifacts to this storage system using Server-Side Encryption (SSE-KMS).
> **Note:** As per current codebase evidence, the S3 + SSE-KMS adapter is implemented and verified during preflight; however, the external AWS infrastructure is not provisioned/evidenced. The `.env.example` defaults to `filesystem`, and no Terraform/CloudFormation scripts exist to create the KMS keys or S3 buckets. The system currently relies on the local filesystem for operations.)*

* **AI CV Parsing & Scoring Service (OpenAI API - configured language model):** SmartHire sends raw text extracted from the CV and the Job Description (JD) text. The API returns structured data including: personal information extracted from the CV, the matching score, and an explanation (strengths/watch-outs).
* **ClamAV Definition Service (Freshclam):** SmartHire periodically requests and downloads the latest malware signatures from this service to ensure the internal ClamAV engine is up-to-date before and during the scanning of uploaded documents and images.

**C. What sensitive data requires strict protection?**

* **Candidate Personal Information & CVs:** Includes names, emails, phone numbers, and detailed content within PDF CVs. These CV files must be stored securely (currently via encrypted local filesystem, with SSE-KMS logic programmed for future AWS S3 integration) and must not be publicly accessible via URL.
* **Login Session Data & Passwords:** Passwords must be hashed (using algorithms like bcrypt/argon2) before storage. Session tokens (Opaque sessions via Better Auth) must be securely stored as HttpOnly cookies, with the Secure flag and strict prefixes (`__Host-`/`__Secure-`) enforced in the production environment to protect session tokens against client-side script access and network interception.

> **Note:** Sensitive data regarding Company Documents (e.g., Business licenses) is deferred to PA5).*