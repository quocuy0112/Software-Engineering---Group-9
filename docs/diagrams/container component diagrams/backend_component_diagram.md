# C4 Level 3 Component Diagram — Backend

**Performed by:** Nguyễn Minh Khôi<br>
**Student ID:** 24127066<br>
**Reviewed by:** Nguyễn Gia Quốc Uy<br>
**Edited by:** Nguyễn Minh Khôi

**Architecture scope:** Backend and worker components that implement the currently implemented SmartHire baseline, including the admin lifecycle worker.

**C4 modeling note:** The frontend and backend are not separate deployable containers. Level 3A is the **backend logical component view** of the same `Next.js Web Application` shown at Level 2; it decomposes the container's **server-side services & API routes** (Next.js App Router Route Handlers and their supporting services). The `App Router and React UI` component is included only to show the in-container ingress relationship; its internal UI components are documented in the Frontend Component Diagram. Level 3B separately decomposes the CV Worker, Image Search Worker, OCR Engine, and Admin Worker containers.

## Level 3A — Web Application Components

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 60, "rankSpacing": 90}}}%%
graph TD
    User["User\n[Person]\nGuest or candidate"]
    RecruiterActor["Recruiter / Company Member\n[Person]\nMembership-authorized API caller"]

    subgraph NextWeb["Next.js Web Application\n[Container] — web/"]
      direction TB

      Presentation["App Router and React UI\nNext.js Pages, Server/Client Components"]

      subgraph ServerSide["Server-side Services & API Routes\nNext.js App Router Route Handlers\nand supporting backend services"]
        direction TB

        RouteHandlers["Route Handlers\nNext.js App Router"]
        RequestSecurity["Request Security Boundary\nBetter Auth session, CSRF/origin,\ncapability, Zod"]

        IdentityServices["Identity & Account Services\nRegistration, login, 2FA,\nrecovery, session, preferences"]
        ProfileServices["Candidate Profile Services\nRead and update Profile aggregate"]
        JobServices["Job Discovery Services\nDeterministic search, save,\napply and report job"]
        StageServices["Application Stage Management\nMembership-authorized recruiter API\ntransitions candidate application stages"]
        CvServices["CV Import Services\nAdmission, consent, upload,\nreview, retry, confirmation"]
        ImageServices["Image Search Services\nAdmission, capability, status,\nconsent, consume, merge criteria"]
        VerificationServices["Business Verification Services\nRegistry lookup, company email\nchallenge, evidence submission,\ndecision review"]
        AdminServices["Admin Services\nAccount/membership management,\nmoderation, job-post review,\nnotifications, support, connections"]

        AuthGateway["Better Auth Gateway\nOwns browser session\nand authentication operations"]
        Persistence["Persistence Layer / Prisma Data Access\nRepository abstractions plus current\nservice-owned Prisma transactions"]
        RepositorySupport["Service-located Policies & Helpers\nJob policy/types/normalization, CV errors,\nprofile validation and CandidateCv projection"]
        StorageAdapters["Private Storage Adapters\nSelect filesystem or S3, enforce\nencryption/integrity contract"]
        SharedContracts["Shared Contracts\nZod and TypeScript — schemas\nshared across server/client/worker"]
      end
    end

    subgraph DataStores["Data Stores"]
        PostgreSQL[("PostgreSQL\nContainer\nPostgreSQL 16 — business\ndata and durable work")]
        CVLocalStorage[("Local CV Artifact Store\nLogical data store\nEncrypted filesystem — default")]
        SearchLocalStorage[("Local Search Artifact Store\nLogical data store\nEncrypted filesystem — default")]
        AdminEvidence[("Local Admin Evidence Store\nLogical data store\nEncrypted filesystem — default")]
    end

    AWSStorage["AWS S3/KMS\nExternal — optional\nBackend implemented, requires\nexternal infrastructure/config"]
    BusinessRegistry["VietQR Business Registry\nExternal — optional\nEnabled by business registry\nprovider configuration"]

    User -->|"HTTPS"| Presentation
    RecruiterActor -->|"HTTPS — application-stage command"| RouteHandlers
    Presentation -->|"HTTPS / JSON / raw stream —\nsend command/query from client"| RouteHandlers
    Presentation -->|"Server-rendered query"| IdentityServices
    Presentation -->|"Server-rendered query"| ProfileServices
    Presentation -->|"Server-rendered query"| JobServices

    RouteHandlers -->|"Authenticate/authorize/validate request;\nobtain actor, session or capability context"| RequestSecurity
    RouteHandlers -->|"Invoke identity/account use case\nusing validated context"| IdentityServices
    RouteHandlers -->|"Invoke Profile use case\nusing validated context"| ProfileServices
    RouteHandlers -->|"Invoke job use case\nusing validated context"| JobServices
    RouteHandlers -->|"Invoke membership-authorized\napplication-stage transition"| StageServices
    RouteHandlers -->|"Invoke CV use case\nusing validated context"| CvServices
    RouteHandlers -->|"Invoke image-search use case\nusing validated context"| ImageServices
    RouteHandlers -->|"Invoke verification use case\nusing validated context"| VerificationServices
    RouteHandlers -->|"Invoke admin use case\nusing validated context"| AdminServices

    IdentityServices -->|"Authentication and session management"| AuthGateway
    IdentityServices -->|"Read/write account, token, audit"| Persistence
    ProfileServices -->|"Read/write Profile aggregate"| Persistence
    JobServices -->|"Query jobs and write user\nstate"| Persistence
    StageServices -->|"Service-owned Prisma transaction:\nstage event, notification work, outbox, audit"| Persistence
    CvServices -->|"Repository access and current\nservice-owned Prisma transactions"| Persistence
    ImageServices -->|"Repository access and current\nservice-owned Prisma transactions"| Persistence
    VerificationServices -->|"Repository access and service-owned\nPrisma transactions"| Persistence
    AdminServices -->|"Repository access and service-owned\nPrisma transactions"| Persistence
    Persistence -.->|"Repository implementations import/call\nselected service-located policies, errors,\nvalidation and projection helpers"| RepositorySupport
    CvServices -->|"Store/read CV artifact"| StorageAdapters
    ImageServices -->|"Store/read search artifact"| StorageAdapters
    VerificationServices -->|"Store/read verification evidence"| StorageAdapters

    RouteHandlers -->|"Validate transport schema"| SharedContracts
    IdentityServices -->|"Validate use-case data"| SharedContracts
    ProfileServices -->|"Validate use-case data"| SharedContracts
    JobServices -->|"Validate search contract"| SharedContracts
    StageServices -->|"Validate stage transition contract"| SharedContracts
    CvServices -->|"Validate CV contract"| SharedContracts
    ImageServices -->|"Validate image-search contract"| SharedContracts
    VerificationServices -->|"Validate verification contract"| SharedContracts
    AdminServices -->|"Validate admin contract"| SharedContracts
    RepositorySupport -->|"Use shared schemas/types\nwhere applicable"| SharedContracts

    AuthGateway -->|"PostgreSQL wire protocol via Prisma —\nread/write auth-owned tables"| PostgreSQL
    Persistence -->|"PostgreSQL wire protocol via Prisma —\nrepository and service-owned query/transaction"| PostgreSQL
    StorageAdapters -->|"Filesystem API —\nwhen CV uses filesystem"| CVLocalStorage
    StorageAdapters -->|"Filesystem API — when image\nsearch uses filesystem"| SearchLocalStorage
    StorageAdapters -->|"Filesystem API — when evidence\nuses filesystem"| AdminEvidence
    StorageAdapters -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    VerificationServices -.->|"HTTPS — business registry\nlookup when provider enabled"| BusinessRegistry

    classDef container fill:#f8fafc,stroke:#475569,stroke-width:1.2px,color:#0f172a;
    classDef person fill:#eef2ff,stroke:#1d4ed8,stroke-width:1.2px,color:#1e3a8a;
    classDef external fill:#fff7e6,stroke:#8a5a00,stroke-width:1.2px,color:#0f172a,stroke-dasharray: 5 5;
    class PostgreSQL,CVLocalStorage,SearchLocalStorage,AdminEvidence container;
    class User,RecruiterActor person;
    class AWSStorage,BusinessRegistry external;
```

### Component descriptions — 3A

#### User (guest / candidate)

- **Responsibilities:** Interact with App Router/React UI via browser.
- **Relationships:** Calls `App Router and React UI` over HTTPS.

#### Recruiter / Company Member

- **Responsibilities:** Call the implemented recruiter application-stage API as an authenticated, active member of the job's company. No complete recruiter frontend is represented.
- **Relationships:** Calls the applicable `Route Handler` over HTTPS; the handler obtains actor context from the request-security boundary and invokes `Application Stage Management`.

#### App Router and React UI

- **Responsibilities:** Render pages, maintain interactive state in the browser, send commands/queries to Route Handlers, and perform server-rendered queries directly to Identity, Profile, and Job services for SSR/RSC portions.
- **Technology:** Next.js Pages, Server/Client Components.
- **Relationships:** Calls `Route Handlers`, `Identity & Account Services`, `Candidate Profile Services`, and `Job Discovery Services`. Server-rendered pages call the service groups in process; client-side commands go through Route Handlers.

#### Server-side Services & API Routes (component group)

- **Responsibilities:** The in-container backend surface of the `Next.js Web Application` — the Next.js App Router Route Handlers (the HTTP API routes) plus the supporting backend services they invoke. This group is the backend interface that the Frontend Component Diagram references; it is decomposed in full below.
- **Technology:** Next.js App Router, TypeScript, Prisma, Zod.
- **Relationships:** Contains `Route Handlers`, `Request Security Boundary`, the application service groups, and the shared backend infrastructure (`Better Auth Gateway`, `Persistence Layer / Prisma Data Access`, `Private Storage Adapters`, `Shared Contracts`).

#### Route Handlers

- **Responsibilities:** Parse requests/responses, use `no-store`, call request-security helpers to obtain validated actor/session/capability context, and invoke application services with that context; validate transport schemas via `Shared Contracts`.
- **Technology:** Next.js App Router.
- **Relationships:** Calls `Request Security Boundary`, the applicable application service, and `Shared Contracts`. **Does not** call Prisma/provider directly.

#### Request Security Boundary

- **Responsibilities:** Authenticate session/ownership (Better Auth session), check CSRF/origin and capability requirements, and return validated request/actor context to the Route Handler. It does not orchestrate application services.
- **Technology:** Better Auth session, CSRF/origin check, capability, Zod.
- **Relationships:** Called by `Route Handlers`; returns validated actor, session, capability, idempotency, or related request context to the caller.

#### Identity & Account Services

- **Responsibilities:** Registration, login, 2FA, recovery, session, and preferences.
- **Technology:** TypeScript.
- **Relationships:** Uses `Better Auth Gateway` for authentication/session management, reads/writes through `Persistence Layer / Prisma Data Access`, and validates use-case data via `Shared Contracts`.

#### Candidate Profile Services

- **Responsibilities:** Read and update Profile aggregate.
- **Technology:** TypeScript.
- **Relationships:** Reads/writes through `Persistence Layer / Prisma Data Access` and validates via `Shared Contracts`.

#### Job Discovery Services

- **Responsibilities:** Deterministic search, save, apply, and report job.
- **Technology:** TypeScript.
- **Relationships:** Queries/writes user state through the `Persistence Layer / Prisma Data Access`, validates search contracts via `Shared Contracts`.

#### Application Stage Management

- **Responsibilities:** Implement the narrowly scoped recruiter API that permits an authorized active company member to transition a candidate application stage. It records the stage event, recruitment notification work, optional email outbox work, and audit evidence. It does not represent a complete recruiter portal.
- **Technology:** TypeScript service with a service-owned Prisma transaction.
- **Relationships:** Invoked by the recruiter Route Handler after request authentication and input validation; validates the stage-transition contract through `Shared Contracts`; accesses PostgreSQL through `Persistence Layer / Prisma Data Access`.

#### CV Import Services

- **Responsibilities:** Admission, consent, upload, review, retry, and confirmation for CV import flow.
- **Technology:** TypeScript.
- **Relationships:** Writes lifecycle, consent, and work state through `Persistence Layer / Prisma Data Access`, stores/reads artifacts via `Private Storage Adapters`, and validates CV contracts via `Shared Contracts`.

#### Image Search Services

- **Responsibilities:** Admission, capability, status, consent, consume, and merge job search criteria from images.
- **Technology:** TypeScript.
- **Relationships:** Writes lifecycle, rate-limit, and capability state through `Persistence Layer / Prisma Data Access`, stores/reads search artifacts via `Private Storage Adapters`, and validates image-search contracts via `Shared Contracts`.

#### Business Verification Services

- **Responsibilities:** Recruiter/company verification preparation — business-registry lookup with rate limiting and caching, company-email challenge/confirmation, evidence submission, and verification decision review.
- **Technology:** TypeScript.
- **Relationships:** Reads/writes preparation, challenge, evidence, and verification state through `Persistence Layer / Prisma Data Access`, stores/reads verification evidence via `Private Storage Adapters`, calls the optional `VietQR Business Registry` over HTTPS when the provider is enabled, and validates verification contracts via `Shared Contracts`.

#### Admin Services

- **Responsibilities:** Administrator-facing operations — account and company-membership management, moderation and messaging-report review, job-post review/management, in-app and security notifications, support-case handling, and professional-connection proposal review.
- **Technology:** TypeScript.
- **Relationships:** Reads/writes admin, audit, notification, support, and connection state through `Persistence Layer / Prisma Data Access` and validates admin contracts via `Shared Contracts`.

#### Better Auth Gateway

- **Responsibilities:** Owns browser session and authentication operations.
- **Technology:** Better Auth.
- **Relationships:** Called by `Identity & Account Services`; **reads/writes directly** to Better Auth-owned PostgreSQL tables via its Prisma adapter, outside the application `Persistence Layer / Prisma Data Access` component.

#### Persistence Layer / Prisma Data Access

- **Responsibilities:** Represent current Prisma-backed persistence across all domains. This includes repository abstractions where implemented and direct/service-owned Prisma queries and transactions where the current source keeps persistence inside a service.
- **Technology:** Prisma 7.
- **Relationships:** Used by Identity/Profile/Job/Application Stage/CV/Image/Verification/Admin services and queries/transactions on `PostgreSQL` via Prisma. Repository implementations also import selected modules under `web/src/backend/services/`, represented by `Service-located Policies & Helpers`; therefore neither persistence style nor the physical source dependency is uniformly Service → Repository.

#### Service-located Policies & Helpers

- **Responsibilities:** Represent policy, type, normalization, error, validation, and projection helpers that repository implementations currently reuse. Examples include job application policy/search normalization, CV HTTP errors, profile validation, and the `CandidateCv` projection helper used by Apply.
- **Technology:** TypeScript modules currently located under `web/src/backend/services/jobs/`, `services/cv-import/`, and `services/profile/`.
- **Relationships:** Imported or called by selected repository implementations inside `Persistence Layer / Prisma Data Access`; may use `Shared Contracts`. This component documents the current implementation rather than claiming an ideal strict-layer dependency. Moving these cross-layer helpers to a shared domain/application-support boundary would require a separate source-code refactor.

#### Private Storage Adapters

- **Responsibilities:** Select filesystem or S3 and enforce encryption/integrity contract for CV, search, and admin evidence artifacts.
- **Technology:** TypeScript ports/adapters.
- **Relationships:** Called by `CV Import Services`, `Image Search Services`, and `Business Verification Services`; reads/writes `Local CV Artifact Store`, `Local Search Artifact Store`, and `Local Admin Evidence Store` via Filesystem API when using filesystem adapter (default); reads/writes `AWS S3/KMS` via AWS S3 API/HTTPS only when adapter is `s3` (not yet provisioned in the repository).

#### Shared Contracts

- **Responsibilities:** Provide Zod schemas shared across server, client, and worker for validating use-case/transport data.
- **Technology:** Zod, TypeScript.
- **Relationships:** Called by `Route Handlers` and all application services for validation.

#### PostgreSQL

- **Responsibilities:** Store business data and durable work (outbox, CV import jobs, image-search jobs).
- **Relationships:** Accessed by `Better Auth Gateway` and `Persistence Layer / Prisma Data Access` via Prisma.

#### Local CV Artifact Store / Local Search Artifact Store / Local Admin Evidence Store

- **Responsibilities:** Store CV, search, and verification-evidence artifacts when the storage adapter is filesystem (default).
- **Relationships:** Accessed by `Private Storage Adapters` via Filesystem API.

#### AWS S3/KMS — optional

- **Responsibilities:** Alternative backend storage implemented at adapter level but not yet provisioned in the repository.
- **Relationships:** Called by `Private Storage Adapters` only when adapter is configured as `s3`.

#### VietQR Business Registry — optional

- **Responsibilities:** Public business-registry lookup used during recruiter/company verification preparation.
- **Relationships:** Called by `Business Verification Services` over HTTPS only when the business registry provider is enabled.

## Level 3B — Worker and OCR Engine Components

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 60, "rankSpacing": 90}}}%%
graph TD
    subgraph CVWorkerBoundary["CV Worker\n[Container]"]
        direction TB
        CvRuntime["Worker Runtime & Lease Controller\nNode.js — claim durable work,\ndeadline, retry, supervision"]
        CvScan["CV Scan Stage\nClamAV adapter — fail-closed scan\nbefore extraction"]
        CvExtract["Hybrid Extraction\nPDF.js, Mammoth, yauzl, Canvas, Sharp\n— native-first, create OCR units"]
        CvParse["CV Parser\nDeterministic or OpenAI adapter\n— create draft with provenance/warning"]
        CvCleanup["CV Cleanup & Reconciliation\nNode.js — delete expired temp/artifact,\nfix orphan states"]
    end

    subgraph ImageWorkerBoundary["Image Search Worker\n[Container]"]
        direction TB
        ImageRuntime["Worker Runtime & Lease Controller\nNode.js — claim stage, hold\nimmutable deletion deadline"]
        ImageScan["Malware Scan Stage\nClamAV adapter — fail-closed scan\nbefore any image decoding"]
        ImageDecode["Decode & Normalize Stage\nSharp — check format/pixels,\nnormalize sRGB PNG"]
        ImageOcrStage["OCR Stage\nOcrEngine port — send PNG,\ncheck strict OCR result"]
        ImageInterpret["Intent Interpretation\nOpenAI adapter, selection policy —\ngenerate criteria suggestions, check evidence/schema"]
        ImageCleanup["Search Cleanup & Reconciliation\nNode.js — physically delete artifact\nwithin 15-minute deadline"]
    end

    subgraph OCRBoundary["OCR Engine\n[Container]"]
        direction TB
        OcrApi["Private Recognition API\nFastAPI on Unix socket —\nhealth check, request limits,\npurpose/deadline validation"]
        OcrRuntime["Paddle OCR ONNX Runtime\nPaddleOCR, ONNX Runtime CPU —\ndetection, recognition, geometry, confidence"]
        OcrStartup["OCR Engine Startup & Model Integrity\nLoad manifest, verify model digests,\ninitialize and warm runtime"]
    end

    subgraph AdminWorkerBoundary["Admin Worker\n[Container]"]
        direction TB
        AdminRuntime["Admin Worker Runtime & Loop Scheduler\nNode.js — periodic lifecycle loops\n(snapshot, verification, retention, support,\nconnections, job-post)"]
        AdminVerification["Verification & Evidence Safety\nClamAV adapter — scan evidence\nfail-closed; verification deadlines"]
        AdminNotifications["Notification & Reconciliation\nSecurity/verification notifications,\nin-app retention, outbox reconcile"]
        AdminRetention["Evidence & Rationale Retention\nDelete expired evidence and\nprivileged-action rationales"]
        AdminSupport["Support & Connections Lifecycle\nClose due support cases, expire\nprofessional-connection proposals"]
        AdminJobPost["Job-Post Lifecycle\nAuto-archive published jobs past\ntheir application deadline"]
    end

    PostgreSQL[("PostgreSQL\nWork state, lease, consent,\naudit, deletion evidence")]
    CVLocalStorage[("Local CV Artifact Store\nCV source/derivative — filesystem")]
    SearchLocalStorage[("Local Search Artifact Store\nEphemeral artifact — filesystem")]
    AdminEvidence[("Local Admin Evidence Store\nVerification evidence — filesystem")]
    ClamAV["Malware Scanner\nContainer — Private Unix socket"]
    AWSStorage["AWS S3/KMS\nExternal — optional, implemented"]
    OpenAI["OpenAI Responses API\nExternal — optional, consent-gated"]
    ClamAVUpdates["ClamAV Definition Service\nExternal — signature source for freshclam"]

    CvRuntime -->|"PostgreSQL wire protocol via Prisma —\nclaim/update CV work and lease"| PostgreSQL
    CvRuntime -->|"Orchestrate scan"| CvScan
    CvRuntime -->|"Orchestrate extraction"| CvExtract
    CvRuntime -->|"Orchestrate parsing"| CvParse
    CvRuntime -->|"Orchestrate cleanup/reconciliation"| CvCleanup

    CvScan -->|"Unix socket — scan CV"| ClamAV
    CvScan -->|"Read encrypted source\nwhen using filesystem"| CVLocalStorage
    CvScan -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    CvExtract -->|"Read source and write segment\nwhen using filesystem"| CVLocalStorage
    CvExtract -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    CvExtract -->|"Unix socket / HTTP —\neligible OCR units"| OcrApi
    CvParse -->|"Read segment and write draft\nwhen using filesystem"| CVLocalStorage
    CvParse -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    CvParse -.->|"HTTPS — send text\nwhen permitted"| OpenAI
    CvCleanup -->|"Claim cleanup\nand write evidence"| PostgreSQL
    CvCleanup -->|"Delete artifact\nwhen using filesystem"| CVLocalStorage
    CvCleanup -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage

    ImageRuntime -->|"PostgreSQL wire protocol via Prisma —\nclaim/update image-search stage"| PostgreSQL
    ImageRuntime -->|"Claim and orchestrate SCAN"| ImageScan
    ImageRuntime -->|"After successful scan, claim\nand orchestrate DECODE"| ImageDecode
    ImageRuntime -->|"Orchestrate OCR"| ImageOcrStage
    ImageRuntime -->|"Orchestrate interpretation"| ImageInterpret
    ImageRuntime -->|"Orchestrate cleanup/reconciliation"| ImageCleanup

    ImageScan -->|"Unix socket — scan image"| ClamAV
    ImageScan -->|"Read source when using filesystem"| SearchLocalStorage
    ImageScan -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    ImageScan -->|"Persist clean assessment; only then\nmake DECODE claimable"| PostgreSQL
    ImageDecode -->|"Read source, write normalized\nPNG when using filesystem"| SearchLocalStorage
    ImageDecode -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    ImageOcrStage -->|"Read normalized PNG\nwhen using filesystem"| SearchLocalStorage
    ImageOcrStage -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    ImageOcrStage -->|"Unix socket / HTTP —\nrecognize text"| OcrApi
    ImageInterpret -->|"Read OCR text, write\ncandidate intent (filesystem)"| SearchLocalStorage
    ImageInterpret -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    ImageInterpret -.->|"HTTPS — send OCR text\nwhen consent/policy permits"| OpenAI
    ImageCleanup -->|"Claim cleanup, write\ndeletion evidence"| PostgreSQL
    ImageCleanup -->|"Delete content artifact\nwhen using filesystem"| SearchLocalStorage
    ImageCleanup -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage

    ClamAV -.->|"HTTPS — update signatures\nusing freshclam"| ClamAVUpdates

    AdminRuntime -->|"Orchestrate verification\nand evidence safety"| AdminVerification
    AdminRuntime -->|"Orchestrate notification\nand reconciliation"| AdminNotifications
    AdminRuntime -->|"Orchestrate retention"| AdminRetention
    AdminRuntime -->|"Orchestrate support and\nconnections lifecycle"| AdminSupport
    AdminRuntime -->|"Orchestrate job-post\nlifecycle"| AdminJobPost

    AdminRuntime -->|"PostgreSQL wire protocol via Prisma —\nread/write lifecycle state"| PostgreSQL
    AdminVerification -->|"PostgreSQL wire protocol via Prisma —\nclaim/update verification work"| PostgreSQL
    AdminNotifications -->|"PostgreSQL wire protocol via Prisma —\nreconcile notifications/outbox"| PostgreSQL
    AdminRetention -->|"PostgreSQL wire protocol via Prisma —\nclaim due evidence/rationales"| PostgreSQL
    AdminSupport -->|"PostgreSQL wire protocol via Prisma —\nclose/purge due cases"| PostgreSQL
    AdminJobPost -->|"PostgreSQL wire protocol via Prisma —\narchive expired jobs"| PostgreSQL
    AdminVerification -->|"Unix socket — scan evidence"| ClamAV
    AdminVerification -->|"Read/delete evidence\nwhen using filesystem"| AdminEvidence
    AdminRetention -->|"Delete evidence\nwhen using filesystem"| AdminEvidence
    AdminVerification -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage
    AdminRetention -.->|"AWS S3 API / HTTPS —\nwhen adapter is s3"| AWSStorage

    OcrStartup -->|"Initialize and warm after\nmanifest/artifact verification"| OcrRuntime
    OcrApi -->|"Compare caller's expected digest\nwith already loaded manifest state"| OcrRuntime
    OcrApi -->|"Call recognition"| OcrRuntime

    classDef container fill:#f8fafc,stroke:#475569,stroke-width:1.2px,color:#0f172a;
    classDef external fill:#fff7e6,stroke:#8a5a00,stroke-width:1.2px,color:#0f172a,stroke-dasharray: 5 5;
    class PostgreSQL,CVLocalStorage,SearchLocalStorage,AdminEvidence,ClamAV container;
    class AWSStorage,OpenAI,ClamAVUpdates external;
```

### Component descriptions — 3B

#### Worker Runtime & Lease Controller (CV Worker / Image Search Worker)

- **Responsibilities:** Claim durable work from PostgreSQL, hold lease/deadline, retry, supervision, and orchestrate internal stages.
- **Technology:** Node.js.
- **Relationships:** Claims/updates work via Prisma on `PostgreSQL`; orchestrates child stages within the same container.

#### CV Scan Stage

- **Responsibilities:** Perform fail-closed malware scan on CV documents before extraction.
- **Technology:** ClamAV adapter.
- **Relationships:** Calls `Malware Scanner` via Unix socket; reads encrypted source from `Local CV Artifact Store` (filesystem, default) or `AWS S3/KMS` when adapter is `s3`.

#### Hybrid Extraction

- **Responsibilities:** Native-first extraction (PDF.js, Mammoth, yauzl, Canvas, Sharp); create OCR units for content requiring OCR.
- **Relationships:** Reads source/writes segments to `Local CV Artifact Store` (or optional S3); calls `OCR Engine` via Unix socket/HTTP for eligible OCR units.

#### CV Parser

- **Responsibilities:** Create draft with provenance and warnings from extracted content.
- **Technology:** Deterministic adapter (default) or OpenAI adapter (optional, requires permission).
- **Relationships:** Reads segments/writes drafts to `Local CV Artifact Store`; calls `OpenAI Responses API` via HTTPS only when permitted.

#### CV Cleanup & Reconciliation

- **Responsibilities:** Delete expired artifacts/temp files, fix orphan states.
- **Relationships:** Claims cleanup and writes evidence to `PostgreSQL`; deletes artifacts from `Local CV Artifact Store` (or optional S3).

#### Malware Scan Stage (Image Search Worker)

- **Responsibilities:** Fail closed while scanning an uploaded image before any decode operation. A successful assessment advances durable work so DECODE becomes claimable.
- **Technology:** ClamAV adapter.
- **Relationships:** Calls `Malware Scanner`; reads the source from `Local Search Artifact Store` (or optional S3); persists the scan outcome to PostgreSQL.

#### Decode & Normalize Stage (Image Search Worker)

- **Responsibilities:** After successful malware scanning, enforce format and decoded-pixel limits and normalize the image to an sRGB PNG.
- **Technology:** Sharp.
- **Relationships:** Reads source and writes normalized PNG to `Local Search Artifact Store` (or optional S3). It is separately claimed as the durable DECODE stage after SCAN succeeds.

#### OCR Stage (Image Search Worker)

- **Responsibilities:** Send normalized PNG to OCR Engine and enforce strict OCR result checking.
- **Relationships:** Reads normalized PNG from `Local Search Artifact Store`; calls `OCR Engine` via Unix socket/HTTP.

#### Intent Interpretation

- **Responsibilities:** Generate job search criteria suggestions from OCR text, check evidence and schema.
- **Technology:** OpenAI adapter, selection policy.
- **Relationships:** Reads OCR text/writes candidate intent to `Local Search Artifact Store`; calls `OpenAI Responses API` via HTTPS only when consent/policy permits.

#### Search Cleanup & Reconciliation

- **Responsibilities:** Physically delete artifacts within a 15-minute deadline.
- **Relationships:** Claims cleanup, writes deletion evidence to `PostgreSQL`; deletes content artifacts from `Local Search Artifact Store` (or optional S3).

#### Private Recognition API

- **Responsibilities:** Health check, request limits, purpose and deadline validation for OCR requests.
- **Technology:** FastAPI on Unix socket.
- **Relationships:** Receives requests from `Hybrid Extraction` (CV Worker) and `OCR Stage` (Image Search Worker); compares the caller's expected manifest digest with already loaded engine state and calls `Paddle OCR ONNX Runtime`.

#### Paddle OCR ONNX Runtime

- **Responsibilities:** Detection, recognition, geometry, confidence on normalized images.
- **Technology:** PaddleOCR, ONNX Runtime CPU.
- **Relationships:** Initialized and warmed by `OCR Engine Startup & Model Integrity` after model artifacts pass digest verification; called by `Private Recognition API` for recognition.

#### OCR Engine Startup & Model Integrity

- **Responsibilities:** At OCR Engine startup, load the pinned manifest, reject unsafe runtime-download/network settings, verify required ONNX artifacts against SHA-256 digests, initialize the PaddleOCR/ONNX pipeline, and warm it before readiness. This is internal startup behavior, not an independently called per-request service.
- **Relationships:** Initializes and warms `Paddle OCR ONNX Runtime` only after manifest and artifact verification succeeds. Recognition requests compare the caller's expected manifest digest with the already loaded engine state; they do not re-hash every model artifact per request.

#### Malware Scanner

- **Responsibilities:** Scan files/images via Unix socket for both workers.
- **Relationships:** Called by `CV Scan Stage`, `Malware Scan Stage`, and `Verification & Evidence Safety`; updates signatures from `ClamAV Definition Service` via HTTPS (`freshclam`).

#### Admin Worker Runtime & Loop Scheduler

- **Responsibilities:** Run the periodic admin lifecycle loops — dashboard snapshot, verification, evidence safety, notifications, retention, support, connections, and job-post archival — with per-loop intervals and a readiness probe.
- **Technology:** Node.js.
- **Relationships:** Orchestrates the internal lifecycle stages and claims/updates work on `PostgreSQL` via Prisma.

#### Verification & Evidence Safety

- **Responsibilities:** Safety-scan recruiter verification evidence fail-closed and enforce verification deadlines, admin-inbox reconciliation, and business-verification preparation cleanup.
- **Technology:** ClamAV adapter, evidence storage adapters.
- **Relationships:** Calls `Malware Scanner` via Unix socket; reads/deletes evidence from `Local Admin Evidence Store` (or optional S3); writes verification state and notifications to `PostgreSQL`.

#### Notification & Reconciliation

- **Responsibilities:** Dispatch due security/verification notifications, reconcile in-app and email delivery channels, and retain/delete expired notifications.
- **Technology:** Node.js, Prisma.
- **Relationships:** Writes notification and email-outbox work to `PostgreSQL`.

#### Evidence & Rationale Retention

- **Responsibilities:** Delete expired verification evidence and privileged-action rationales on their retention deadlines.
- **Technology:** Node.js, evidence storage adapters.
- **Relationships:** Claims due rows on `PostgreSQL`; deletes evidence from `Local Admin Evidence Store` (or optional S3).

#### Support & Connections Lifecycle

- **Responsibilities:** Close due support cases, requeue invalid assignments, purge retained content, and expire/reconcile professional-connection proposals.
- **Technology:** Node.js, Prisma.
- **Relationships:** Reads/writes support and connection state on `PostgreSQL`; publishes realtime invalidation events in-process.

#### Job-Post Lifecycle

- **Responsibilities:** Auto-archive published job posts once their application deadline passes.
- **Technology:** Node.js, Prisma.
- **Relationships:** Updates job-post aggregate and operational history on `PostgreSQL`.
