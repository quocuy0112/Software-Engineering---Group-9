# C4 Deployment Diagram — SmartHire

**Author:** Nguyễn Minh Khôi<br>
**Student ID:** 24127066<br>
**Reviewer:** Nguyễn Gia Quốc Uy<br>
**Editor:** Nguyễn Minh Khôi


```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 60, "rankSpacing": 90, "diagramPadding": 20}}}%%
graph TD
    classDef default fill:#ffffff,stroke:#000000,color:#000000;
    classDef service fill:#f7fbff,stroke:#1f4e79,stroke-width:1.2px,color:#000000;
    classDef optional fill:#fff7e6,stroke:#8a5a00,stroke-width:1px,color:#000000,stroke-dasharray: 4 3;

    subgraph UserZone["User Access"]
        Browser["Developer / Browser\n[Web client]\nAccess localhost:3001"]
    end

    subgraph Host["Developer Machine\n[Windows / macOS / Linux]"]
        subgraph NodeRuntime["Node.js 24 Runtime\n[Host processes]"]
            Web["Next.js Web Application\n[Next.js / React / TypeScript]\nSSR/RSC, Route Handlers, localhost:3001"]
            EmailWorker["Email Worker\n[Node.js / TypeScript]\nClaim EmailOutbox and send emails with retry"]
        end

        subgraph Docker["Docker Compose — smarthire\n[Linux containers]"]
            DB["PostgreSQL\n[postgres:16.12]\nHost loopback 55432"]
            ClamAV["Malware Scanner\n[clamav:1.4]\nclamd via Unix socket"]
            CVWorker["CV Worker\n[Node.js container]\nScan, extract, OCR when needed, parse, cleanup"]
            ImageWorker["Image Search Worker\n[Node.js container]\nScan, normalize, OCR, interpret, cleanup"]
            OCR["OCR Engine\n[Python 3.12, PaddleOCR, FastAPI]\nNo network; read-only root"]
        end

        subgraph LocalData["Private Local Data\n[Gitignored bind mounts / Docker volumes]"]
            MailCapture["Local Mail Capture\n[web/.local/mail]\nDefault backend when EMAIL_ADAPTER=capture"]
            CVStorage["Local CV Artifact Store\n[web/.local/cv-storage]\nApplication-encrypted filesystem"]
            SearchStorage["Local Search Artifact Store\n[web/.local/image-search-storage]\nAES-256-GCM filesystem"]
        end
    end

    subgraph ExternalServices["External Services — optional, not running by default"]
        MailProvider["Email Provider\n[SMTP / Resend]\nOnly used when EMAIL_ADAPTER is not capture"]
        AIProvider["OpenAI Responses API\nOnly when feature flag, privacy gate, and consent allow"]
        ClamAVUpdates["ClamAV Virus Definition Service\nSignature source for freshclam"]
    end

    Browser -->|"HTTP localhost:3001"| Web

    Web -->|"PostgreSQL protocol (Prisma)"| DB
    Web -->|"Filesystem API"| CVStorage
    Web -->|"Filesystem API"| SearchStorage

    EmailWorker -->|"PostgreSQL protocol (Prisma)"| DB
    EmailWorker -->|"Filesystem API"| MailCapture
    EmailWorker -.->|"SMTP / HTTPS (optional)"| MailProvider

    CVWorker -->|"PostgreSQL protocol (Prisma)"| DB
    CVWorker -->|"Filesystem API"| CVStorage
    CVWorker -->|"Unix socket"| ClamAV
    CVWorker -->|"Unix socket / HTTP"| OCR
    CVWorker -.->|"HTTPS (optional, consent-gated)"| AIProvider

    ImageWorker -->|"PostgreSQL protocol (Prisma)"| DB
    ImageWorker -->|"Filesystem API"| SearchStorage
    ImageWorker -->|"Unix socket"| ClamAV
    ImageWorker -->|"Unix socket / HTTP"| OCR
    ImageWorker -.->|"HTTPS (optional, consent-gated)"| AIProvider

    ClamAV -.->|"HTTPS (freshclam)"| ClamAVUpdates

    class Web,EmailWorker,CVWorker,ImageWorker,OCR,DB,ClamAV,MailCapture,CVStorage,SearchStorage service;
    class MailProvider,AIProvider,ClamAVUpdates optional;
```

## Node Descriptions

| Node | Infrastructure / Runtime | Container running on it | Protocol to related nodes |
| --- | --- | --- | --- |
| Node.js 24 Runtime | Host process on developer machine | Next.js Web Application, Email Worker | Browser → Web: `HTTP localhost:3001`; Web/EmailWorker → PostgreSQL: `PostgreSQL protocol (Prisma)` |
| Docker Compose — smarthire | Linux container, private network via Docker Compose | PostgreSQL 16, Malware Scanner (ClamAV 1.4), CV Worker, Image Search Worker, OCR Engine | PostgreSQL exposes via host loopback 55432; CV/Image Worker → ClamAV: `Unix socket`; CV/Image Worker → OCR Engine: `Unix socket / HTTP`; OCR Engine has no external network access |
| Private Local Data | Gitignored bind mount / Docker volume on developer machine | Local Mail Capture, Local CV Artifact Store, Local Search Artifact Store | Web/EmailWorker/CVWorker/ImageWorker write via `Filesystem API` |
| Email Provider (optional) | External service (SMTP or Resend) | — | Email Worker → Email Provider: `SMTP / HTTPS`, only when `EMAIL_ADAPTER` is not `capture` |
| OpenAI Responses API (optional) | External service | — | CV Worker / Image Search Worker → OpenAI: `HTTPS`, only when feature flag, privacy gate, and consent are all enabled |
| ClamAV Virus Definition Service | External service | — | Malware Scanner → service: `HTTPS`, used by `freshclam` to update signatures |

## Deployment Description

The Next.js Web Application and Email Worker run as host processes using Node.js directly on the developer machine and serve at `localhost:3001`. The remaining Level 2 components — PostgreSQL, Malware Scanner, CV Worker, Image Search Worker, and OCR Engine — run in Docker Compose (`compose.yaml`), each container as a separate service; the OCR Engine has no network and communicates only via a shared Unix socket with the CV Worker and Image Search Worker.

The default artifact storage in this deployment is the **local filesystem** (`web/.local/mail`, `web/.local/cv-storage`, `web/.local/image-search-storage`), not S3. AWS S3/KMS/IAM adapters are implemented at the code level (see Level 1 and Level 2), but the repository **has not provisioned** any bucket, KMS key, or IAM role, so it is not drawn as a node in use in this actual deployment; it only appears indirectly via the "optional" notes in the corresponding Level 2 containers, not duplicated here as a parallel storage.

The external services — Email Provider, OpenAI Responses API, and ClamAV Definition Service — are all **optional** and do not run by default: locally, the default uses the capture adapter for email (writing to the filesystem) and the deterministic adapter for CV parsing, so the first two services are only called when adapter configuration and (for OpenAI) user consent allow. The ClamAV Definition Service is an exception because `freshclam` needs to run to update malware signatures for the Malware Scanner to function correctly.

Protocols between nodes are recorded as actual network/application-layer protocols rather than library names: PostgreSQL uses the `PostgreSQL protocol` (via Prisma as the client library, not as the protocol), local storage uses the `Filesystem API`, and communication with ClamAV/OCR Engine uses `Unix socket` (along with HTTP for the OCR Engine at the application layer above the socket).

Container names in this diagram match the names in Level 2 (`Next.js Web Application`, `Email Worker`, `CV Worker`, `Image Search Worker`, `OCR Engine`, `Malware Scanner`, `PostgreSQL`) so that readers can directly map Level 2 → Deployment without having to cross-reference different names.