# Research: Recruitment Analytics & Data Export

## Decision 1: Extend Existing Boundaries

**Decision**: Add analytics/export services and repositories inside the existing `web` workspace, using App Router Route Handlers, Better Auth sessions, Administrator grant authorization, and active verified-company membership authorization.

**Rationale**: `web/src/backend/admin/authorization/admin-auth-service.ts` and `web/src/backend/applications/authorization/recruiter-application-authorization.ts` already enforce the required actor boundaries. This preserves the constitution's single browser-session and tenant-isolation rules.

**Alternatives considered**: A separate analytics service or client-only aggregation was rejected because it would create another authorization/data authority and expose sensitive aggregation logic outside server trust boundaries.

## Decision 2: Authoritative Event-Time Analytics

**Decision**: Compute metrics from authoritative timestamps and append-only lifecycle facts using half-open UTC ranges derived from the displayed platform time zone. Publish an `analyticsAvailableFrom` baseline and reject earlier ranges. Every response includes one cutoff and a metric-definition version.

**Rationale**: `JobApplication.submittedAt` and `ApplicationStageEvent.occurredAt` support cohort/cutoff calculations, while current `JobPosting.status` cannot reconstruct active counts at historical bucket ends. Explicit job lifecycle facts close that gap without duplicating mutable posting authority.

**Alternatives considered**: Querying only current rows cannot reproduce history. Guessing pre-baseline history violates accuracy requirements. Periodic aggregate snapshots alone can miss changes and complicate correction; they may be added later as a derived optimization, never as authority.

## Decision 3: Privacy-Safe Qualified Views

**Decision**: Persist one qualifying view per posting, platform day, and versioned HMAC visitor digest. Exclude owning-company previews and identified automated traffic before admission; retain no raw IP, cookie, or browser identifier in the fact.

**Rationale**: The schema has no current job-view fact. A unique durable fact makes conversion repeatable while purpose-limited pseudonymous context enforces the clarified daily uniqueness rule.

**Alternatives considered**: Raw request logging retains excessive personal data; in-memory deduplication is not durable; counting all page loads is explicitly excluded by the specification.

## Decision 4: Leased Asynchronous Exports

**Decision**: Model exports as idempotent database work items claimed with the repository's existing lease/`SKIP LOCKED` pattern. Generate a stable, cutoff-bound projection in application-id order and publish only complete artifacts.

**Rationale**: Existing email/scoring workers already provide bounded lease, retry, and terminal-state conventions. This supports the 10,000-row/10-second goal without blocking an interactive request or presenting partial files.

**Alternatives considered**: Synchronous-only generation risks request timeouts. A new Redis/BullMQ dependency is unnecessary. Direct database dumps would bypass field allow-lists and format/security rules.

## Decision 5: CSV and XLSX Generation

**Decision**: Use one canonical export-row stream. Encode CSV internally with UTF-8 and RFC 4180 quoting; add ExcelJS for streaming XLSX generation with `Candidates` and `Metadata` sheets.

**Rationale**: The current package has no spreadsheet writer. ExcelJS provides a streaming workbook writer suitable for bounded-memory generation, while a small CSV encoder keeps quoting behavior explicit. Both writers share the same normalized strings and column definitions. See the [official ExcelJS repository](https://github.com/exceljs/exceljs).

**Alternatives considered**: Building XLSX from raw XML/ZIP is error-prone; a full CSV dependency adds little for the narrow fixed schema; non-streaming workbook generation increases memory pressure.

## Decision 6: Spreadsheet Injection Defense

**Decision**: Treat all candidate/user-controlled values as text. Prefix CSV values whose first effective character is `=`, `+`, `-`, or `@` with an apostrophe before standard quoting; set XLSX cells as explicit strings and never formulas. Test leading whitespace, tabs, CR/LF, Unicode, quotes, and delimiters.

**Rationale**: The repository has no existing formula-injection policy, and exports contain candidate-controlled values. One shared policy prevents format drift.

**Alternatives considered**: Relying on consumers' spreadsheet settings is unsafe; deleting characters corrupts source values; protecting CSV but not XLSX leaves inconsistent behavior.

## Decision 7: Private Artifact Storage and Cleanup

**Decision**: Create a branded `ExportArtifactStoragePort` with separate configuration/key prefix while reusing the existing private filesystem/S3 streaming conventions. Deny access at 24 hours, then delete idempotently; storage lifecycle is defense in depth.

**Rationale**: Application/CV storage already supplies opaque locators, private access, byte integrity, safe local files, and S3 encryption. A separate purpose boundary prevents export and CV locators or retention policies from being mixed.

**Alternatives considered**: Public/presigned links weaken request-time authorization. Reusing application locators directly couples incompatible retention policies. Storing large artifacts in PostgreSQL increases database load.

## Decision 8: Current Published Screening Score

**Decision**: Export the application's current published `ApplicationScoringResult.finalScore`; represent pending, failed, or absent results as unavailable and never recalculate during export.

**Rationale**: `JobApplication.aiMatchScore` coexists with the canonical published result and may be legacy/summary data. Selecting one canonical source preserves consistency with the recruiter UI and AI provenance.

**Alternatives considered**: Mixing sources can produce different scores across rows. Recalculation changes the report cutoff and violates point-in-time consistency.

## Decision 9: Audit as Evidence, Facts as Metric Authority

**Decision**: Extend the strict audit allow-list for required business events, but calculate core dashboard/application/view metrics from normalized domain facts. Use audit events for the Administrator activity history and operational evidence, with transactional/outbox coupling for required events.

**Rationale**: `AuditEvent` is indexed and privacy-reduced but its JSON context is not a substitute for normalized analytics truth. This separation protects audit immutability while keeping metrics deterministic.

**Alternatives considered**: Using ordinary logs is incomplete and privacy-risky. Using audit JSON as the only metric model creates fragile definitions and correction paths.

## Decision 10: Accessible Visualization Without a New Chart Dependency

**Decision**: Build small project-native visual trend primitives with semantic summaries and equivalent tables; render the funnel as ordered stage regions with headings, counts, and percentages. Do not add a chart library in this phase.

**Rationale**: No chart library exists, and the required series are limited. Existing Administrator MUI cards and recruiter components already establish responsive/accessibility patterns; semantic tables ensure the information is available without color or pointer interaction.

**Alternatives considered**: Adding a broad chart dependency increases bundle and accessibility review scope. Canvas-only charts fail text-equivalence requirements.

## Decision 11: Application Contact Snapshot Is Export Authority

**Decision**: Export candidate name, email, and phone from the immutable contact snapshot captured on the application at submission.

**Rationale**: A point-in-time export must remain reproducible at its data cutoff. Reading the live Candidate profile would let later edits change historical application data and could mix data outside the application's authorized context.

**Alternatives considered**: Live-profile values are fresher but make repeated exports inconsistent and weaken snapshot semantics. Mixing snapshot and live values is ambiguous and was rejected.
