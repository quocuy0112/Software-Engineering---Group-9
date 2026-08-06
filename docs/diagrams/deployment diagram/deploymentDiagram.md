**Author:** Nguyễn Minh Khôi<br>
**Student ID:** 24127066<br>
**Reviewer:** Nguyễn Gia Quốc Uy
# C4 Level 1 Deployment Diagram — SmartHire

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 60, "rankSpacing": 90, "diagramPadding": 20}}}%%
graph TD
    classDef default fill:#ffffff,stroke:#000000,color:#000000;
    classDef service fill:#f7fbff,stroke:#1f4e79,stroke-width:1.2px,color:#000000;

    subgraph UserZone["User Access"]
        Browser["Browser\n[Web client]\nAccesses the SmartHire app over HTTPS"]
    end

    subgraph RuntimeEnv["Production Runtime\n[Docker / Kubernetes / VM host]"]
        subgraph WebTier["Web Tier"]
            Web["Next.js App\n[UI + API Routes]\nServes pages and backend endpoints"]
        end

        subgraph WorkerTier["Background Processing"]
            EmailWorker["Email Worker\n[Node.js worker]\nPolls outbox and sends mail"]
            CVWorker["CV Worker\n[Node.js worker]\nProcesses CV import jobs"]
        end

        subgraph DataTier["Data & Storage"]
            DB["PostgreSQL\n[PostgreSQL 16]\nStores application state and queues"]
            FileStorage["File Storage\n[Local or S3-backed]\nStores uploaded CV artifacts"]
        end

        subgraph SecurityTier["Security Service"]
            ClamAV["ClamAV Scanner\n[Container]\nScans uploaded files"]
        end
    end

    subgraph ExternalServices["External Services"]
        MailProvider["Email Provider\n[SMTP/Resend]\nDelivers outbound mail"]
        AIProvider["AI Provider\n[OpenAI API]\nParses CV content"]
        ObjectStore["Object Storage\n[S3-compatible]\nStores long-lived artifacts"]
    end

    Browser -->|"HTTPS"| Web
    Web -->|"Prisma / SQL"| DB
    Web -->|"File API"| FileStorage
    Web -->|"Creates outbox rows"| DB
    Web -->|"Creates CV import jobs"| DB

    EmailWorker -->|"Polls outbox"| DB
    EmailWorker -->|"SMTP / HTTPS"| MailProvider

    CVWorker -->|"Reads/writes data"| DB
    CVWorker -->|"Reads/writes files"| FileStorage
    CVWorker -->|"Local IPC"| ClamAV
    CVWorker -->|"HTTPS / REST"| AIProvider
    CVWorker -->|"S3 API"| ObjectStore

    ClamAV -->|"Scan result"| CVWorker

    class Web,EmailWorker,CVWorker,DB,FileStorage,ClamAV service;
```

## Deployment Description

The deployment diagram shows SmartHire running as a web application plus background worker services on a shared runtime host or container platform. The Next.js application serves both the browser UI and the backend API routes, and it connects to PostgreSQL for transactional data and to file storage for uploaded CV assets.

Background processing is handled by separate worker services. The Email Worker polls the shared database outbox and sends messages through an external email provider. The CV Worker processes uploaded resumes by reading files from storage, scanning them through the ClamAV service, calling the external AI parsing provider, and storing parsed artifacts in object storage.

The external services in this deployment are:
- SMTP/Resend for outbound mail delivery
- OpenAI-compatible AI provider for CV parsing and content extraction
- S3-compatible object storage for long-lived CV artifacts

This deployment is suitable for a containerized environment such as Docker, Kubernetes, or a VM-based runtime host, with the browser as the user-facing entry point and the database, storage, and scanning services co-located on the same infrastructure.


