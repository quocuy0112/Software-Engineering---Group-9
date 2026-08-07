# C4 Level 2 Container Diagram — SmartHire

**Performed by:** Nguyễn Minh Khôi<br>
**Student ID:** 24127066<br>
**Reviewed by:** Nguyễn Gia Quốc Uy<br>
**Edited by:** Nguyễn Minh Khôi

```mermaid
flowchart TB
    Visitor["Khách tìm việc\n[Person]\nChưa đăng nhập"]
    Candidate["Ứng viên\n[Person]\nĐã đăng nhập"]

    Visitor -->|"HTTPS — Tìm việc, xem chi tiết,\ntìm việc bằng ảnh"| Web
    Candidate -->|"HTTPS — Đăng nhập, quản lý Profile,\nCV và hoạt động tìm việc"| Web

    subgraph SmartHire["SmartHire Platform"]
        direction TB

        subgraph AppLayer["Application layer"]
            Web["Next.js Web Application\nContainer\nNext.js 16, React 19, TypeScript"]
        end

        subgraph WorkerLayer["Background workers"]
            direction TB
            EmailWorker["Email Worker\nContainer\nNode.js / TypeScript"]
            CVWorker["CV Worker\nContainer\nNode.js / TypeScript"]
            ImageWorker["Image Search Worker\nContainer\nNode.js / TypeScript"]
        end

        subgraph ProcessingLayer["Processing services"]
            direction LR
            ClamAV["Malware Scanner\nContainer\nClamAV 1.4"]
            OCREngine["OCR Engine\nContainer\nPython 3.12, PaddleOCR, ONNX Runtime, FastAPI"]
        end

        subgraph DataLayer["Data & storage"]
            direction LR
            DB[("PostgreSQL\nContainer\nPostgreSQL 16, Prisma")]
            MailCapture[("Local Mail Capture\nContainer\nFilesystem — mặc định khi\nEMAIL_ADAPTER=capture")]
            CVStorage[("Local CV Artifact Store\nContainer\nApplication-encrypted filesystem\n— mặc định")]
            SearchStorage[("Local Search Artifact Store\nContainer\nAES-256-GCM filesystem\n— mặc định")]
        end
    end

    subgraph ExternalLayer["External services — tùy chọn trừ khi ghi chú khác"]
        EmailProvider["Email Provider\nSMTP / Resend\nTùy chọn — chỉ khi EMAIL_ADAPTER khác capture"]
        AIProvider["OpenAI Responses API\nTùy chọn — cần feature flag,\nprivacy gate và consent"]
        AWSStorage["AWS S3, KMS, IAM\nTùy chọn — adapter đã implement,\nchưa provision hạ tầng"]
        ClamAVUpdates["ClamAV Definition Service\nNguồn chữ ký cho freshclam"]
    end

    Web -->|"Prisma / PostgreSQL protocol —\nđọc/ghi dữ liệu, tạo outbox và\ndurable work"| DB
    Web -->|"Filesystem storage adapter —\nghi upload CV"| CVStorage
    Web -->|"Filesystem storage adapter —\nghi ảnh tìm kiếm"| SearchStorage
    Web -.->|"AWS S3 API / HTTPS —\nkhi storage adapter là s3"| AWSStorage

    EmailWorker -->|"Prisma / PostgreSQL protocol —\nclaim và cập nhật EmailOutbox"| DB
    EmailWorker -->|"Filesystem API —\nghi email khi dùng capture adapter"| MailCapture
    EmailWorker -.->|"SMTP / HTTPS — gửi email\ngiao dịch (tùy chọn)"| EmailProvider

    CVWorker -->|"Prisma / PostgreSQL protocol —\nclaim lease, cập nhật trạng thái,\ndraft và audit"| DB
    CVWorker -->|"Filesystem storage adapter —\nđọc/ghi/xóa CV artifact"| CVStorage
    CVWorker -.->|"AWS S3 API / HTTPS —\nkhi dùng adapter s3"| AWSStorage
    CVWorker -->|"Private Unix socket —\nquét tài liệu"| ClamAV
    CVWorker -->|"Private Unix socket / HTTP —\nOCR trang PDF hoặc ảnh DOCX"| OCREngine
    CVWorker -.->|"HTTPS — parse CV khi cấu hình\nvà consent cho phép"| AIProvider

    ImageWorker -->|"Prisma / PostgreSQL protocol —\nclaim lease, lifecycle và\ndeletion evidence"| DB
    ImageWorker -->|"Filesystem storage adapter —\nđọc/ghi/xóa search artifact"| SearchStorage
    ImageWorker -.->|"AWS S3 API / HTTPS —\nkhi dùng adapter s3"| AWSStorage
    ImageWorker -->|"Private Unix socket —\nquét ảnh trước khi decode"| ClamAV
    ImageWorker -->|"Private Unix socket / HTTP —\nnhận dạng ảnh đã chuẩn hóa"| OCREngine
    ImageWorker -.->|"HTTPS — diễn giải OCR text\nthành đề xuất bộ lọc"| AIProvider

    ClamAV -->|"HTTPS — cập nhật chữ ký\nbằng freshclam"| ClamAVUpdates

    classDef container fill:#f8fafc,stroke:#475569,stroke-width:1.2px,color:#0f172a;
    classDef person fill:#eef2ff,stroke:#1d4ed8,stroke-width:1.2px,color:#1e3a8a;
    classDef external fill:#fff7e6,stroke:#8a5a00,stroke-width:1.2px,color:#0f172a,stroke-dasharray: 5 5;
    class Web,EmailWorker,CVWorker,ImageWorker,ClamAV,OCREngine,DB,MailCapture,CVStorage,SearchStorage container;
    class Visitor,Candidate person;
    class EmailProvider,AIProvider,AWSStorage,ClamAVUpdates external;
```

## Container descriptions

### 1. Next.js Web Application
- Responsibilities: Serves the React/Next.js UI and API routes, handles authentication, profile management, job-board operations, CV import admission, and writes durable work (email outbox rows, CV import jobs) into PostgreSQL.
- Technology used: Next.js 16, React 19, TypeScript, Better Auth, Prisma, Tailwind CSS.
- Data provided: User sessions, profile data, job listings, applications, audit records, CV import metadata.
- Which container calls it?: `Khách tìm việc` (visitor) and `Ứng viên` (candidate) call it over HTTPS.
- Communication protocol: HTTPS for client traffic; Prisma / PostgreSQL protocol for data access; filesystem storage adapter by default, AWS S3 API/HTTPS only when the storage adapter is switched to `s3` (not provisioned in this repository).

### 2. Email Worker
- Responsibilities: Claims EmailOutbox rows written by the web app and sends transactional email (registration verification, password reset, security notifications) with retry.
- Technology used: Node.js/TypeScript background process, Prisma, capture/SMTP/Resend adapters.
- Data provided: Email outbox rows, delivery attempts, retry metadata, provider result state.
- Which container calls it?: Consumes shared database state written by the Web Application.
- Communication protocol: Prisma / PostgreSQL protocol for claiming outbox rows; Filesystem API to `Local Mail Capture` when `EMAIL_ADAPTER=capture` (the local default); SMTP/HTTPS to the external Email Provider only when a non-capture adapter is configured.

### 3. CV Worker
- Responsibilities: Processes asynchronous CV ingestion — malware scanning coordination, hybrid extraction, OCR for eligible content, optional AI-assisted parsing, cleanup and reconciliation.
- Technology used: Node.js/TypeScript worker, Prisma, ClamAV and OCR Engine adapters.
- Data provided: CV binaries, parser artifacts, review status, extracted text, consent state, derived metadata.
- Which container calls it?: Claims CV import jobs the Web Application writes into PostgreSQL.
- Communication protocol: Prisma / PostgreSQL protocol for lease claim/update; filesystem storage adapter by default (AWS S3 API/HTTPS only if the `s3` adapter is configured); private Unix socket to the Malware Scanner; private Unix socket/HTTP to the OCR Engine; HTTPS to the OpenAI Responses API only when config and consent allow.

### 4. Image Search Worker
- Responsibilities: Processes image-assisted job search — scans and decodes uploaded images, normalizes to PNG, requests OCR, interprets OCR text into search-filter suggestions, and performs cleanup with a strict deletion deadline.
- Technology used: Node.js/TypeScript worker, Prisma, ClamAV and OCR Engine adapters, OpenAI adapter for intent interpretation.
- Data provided: Normalized image artifacts, OCR text, interpreted search criteria, deletion evidence.
- Which container calls it?: Claims image-search work the Web Application writes into PostgreSQL.
- Communication protocol: Prisma / PostgreSQL protocol for lease claim/update; filesystem storage adapter by default (AWS S3 API/HTTPS only if the `s3` adapter is configured); private Unix socket to the Malware Scanner; private Unix socket/HTTP to the OCR Engine; HTTPS to the OpenAI Responses API only when config and consent allow.

### 5. OCR Engine
- Responsibilities: Receives normalized images from CV Worker and Image Search Worker and returns recognized text, geometry, and confidence.
- Technology used: Python 3.12, PaddleOCR, ONNX Runtime, FastAPI, exposed only over a private Unix socket.
- Data provided: Recognition results (text, geometry, confidence) for CV pages and search images.
- Which container calls it?: CV Worker and Image Search Worker.
- Communication protocol: Private Unix socket / HTTP.

### 6. Malware Scanner
- Responsibilities: Scans uploaded CV files and search images for malware before they are accepted into the processing pipeline (fail-closed).
- Technology used: ClamAV 1.4 running in a container with a local socket interface; signatures refreshed via `freshclam` against the ClamAV Definition Service.
- Data provided: Scan requests and scan results.
- Which container calls it?: CV Worker and Image Search Worker.
- Communication protocol: ClamD protocol over a private Unix domain socket (local IPC); HTTPS to the external ClamAV Definition Service for signature updates.

### 7. PostgreSQL
- Responsibilities: System of record for users, authentication, profiles, jobs, applications, audit trails, email outbox, CV import and image-search work state.
- Technology used: PostgreSQL 16 with Prisma ORM.
- Data provided: Persistent application data and durable-work/lease state used by the web app and all workers.
- Which container calls it?: Web Application, Email Worker, CV Worker, Image Search Worker.
- Communication protocol: Prisma / PostgreSQL protocol.

### 8. Local Mail Capture
- Responsibilities: Local default backend for outbound email — writes messages to a gitignored local path instead of sending them, used whenever `EMAIL_ADAPTER=capture`.
- Technology used: Filesystem.
- Data provided: Captured transactional email content for local inspection.
- Which container calls it?: Email Worker.
- Communication protocol: Filesystem API.

### 9. Local CV Artifact Store
- Responsibilities: Default storage for uploaded CV files and processing artifacts when the storage adapter is `filesystem`.
- Technology used: Application-encrypted filesystem.
- Data provided: Uploaded documents, extracted segments, drafts, and retention-controlled content.
- Which container calls it?: Web Application (writes uploads) and CV Worker (reads/writes/deletes artifacts).
- Communication protocol: Filesystem storage adapter.

### 10. Local Search Artifact Store
- Responsibilities: Default storage for image-search artifacts (source image, normalized PNG, OCR text, candidate intent) when the storage adapter is `filesystem`.
- Technology used: AES-256-GCM filesystem.
- Data provided: Ephemeral search artifacts subject to a strict deletion deadline.
- Which container calls it?: Web Application (writes uploads) and Image Search Worker (reads/writes/deletes artifacts).
- Communication protocol: Filesystem storage adapter.

### 11. External Services — tùy chọn
- **Email Provider (SMTP/Resend)** — optional; only called by Email Worker when `EMAIL_ADAPTER` is not `capture`. Protocol: SMTP/HTTPS.
- **OpenAI Responses API** — optional; only called by CV Worker and Image Search Worker when the corresponding feature flag, privacy gate, and user consent all allow it. Protocol: HTTPS.
- **AWS S3, KMS, IAM** — optional; storage/preflight adapters are implemented in code, but this repository does not provision any bucket, KMS key, or IAM role. Only used when the storage adapter is switched to `s3`. Protocol: AWS API/HTTPS.
- **ClamAV Definition Service** — not optional for the Malware Scanner to function correctly; `freshclam` needs it to keep malware signatures current. Protocol: HTTPS.