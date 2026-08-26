<!--
Sync Impact Report
- Version change: 2.2.0 -> 2.3.0
- Modified principles:
  - Principle III - Deterministic Core and Explainable AI: changes the approved
    hybrid CV scoring weights to 40% deterministic matching and 60% AI.
- Added sections: none
- Removed sections: none
- Templates:
  - ✅ spec-kit/.specify/templates/plan-template.md reviewed; its Constitution
    Check and performance fields already cover the amended requirements.
  - ✅ spec-kit/.specify/templates/spec-template.md reviewed; its mandatory user
    scenarios, requirements, and measurable outcomes need no structural change.
  - ✅ spec-kit/.specify/templates/tasks-template.md reviewed; its foundational,
    security, fallback, and verification task structure remains compatible.
  - ✅ spec-kit/.specify/templates/commands/ reviewed; directory is not present.
- Runtime guidance:
  - ✅ README.md and AGENTS.md reviewed; no principle reference requires change.
- Follow-up TODOs: none.
-->

# SmartHire Constitution

This constitution defines the mandatory constraints that every SmartHire
specification, implementation plan, task list, and implementation MUST satisfy.
It contains project rules only.

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
indicate requirement strength. A specification or plan that conflicts with a
`MUST` or `MUST NOT` is invalid until the conflict is resolved.

## Core Principles

### Principle I - Human-Controlled Recruitment (NON-NEGOTIABLE)

SmartHire is an AI-assisted recruitment system, not an autonomous hiring system.

- AI MUST NOT automatically reject, hire, advance, or irreversibly disadvantage
  a candidate without an explicit human decision.
- Recruiters MUST retain final authority over recruitment decisions and MUST be
  able to override AI recommendations.
- Every AI-assisted score MUST include a human-readable explanation of the main
  matching factors, strengths, gaps, and known limitations.
- AI output MUST be presented as a recommendation or estimate, not as objective
  truth.
- Scoring MUST NOT use protected or job-irrelevant personal attributes as
  evidence of candidate suitability.
- Candidate-facing and recruiter-facing explanations MUST remain consistent
  with the same underlying score, even when the displayed level of detail
  differs.

**Rationale:** Recruitment decisions affect real people, while probabilistic AI
output can be incomplete, unstable, biased, or wrong. Accountability MUST remain
with an authorized human.

### Principle II - Security, Privacy, and Tenant Isolation (NON-NEGOTIABLE)

Personal, recruitment, and company data MUST be protected by design.

- Authentication tokens MUST use HttpOnly, Secure, and SameSite cookies. Tokens
  MUST NOT be stored in `localStorage` or `sessionStorage`.
- Authentication and authorization MUST be enforced on the server.
- Authorization MUST combine role-based access control with verified company
  membership checks.
- A user MAY hold memberships in multiple companies, but data belonging to one
  company MUST NOT be accessible through another company membership.
- Access to CVs, contact details, evaluation notes, business documents,
  application records, and exports MUST follow least privilege.
- Passwords MUST be securely hashed and MUST NOT be stored in plain text.
- Sensitive traffic MUST use HTTPS. Inputs and uploaded files MUST be validated
  before processing.
- CV uploads MUST be limited to PDF and DOCX files with a maximum size of 5 MB
  (exactly 5,000,000 bytes), unless this constitution is amended.
- An approved CV-document OCR feature MAY derive temporary raster images from an
  accepted PDF or DOCX and MAY process safe PNG/JPEG media contained within that
  document only after malware and structural validation. This processing MUST
  NOT expand the accepted CV upload types and MUST be isolated, resource-bounded,
  purpose-limited, and covered by the approved CV retention policy.
- An approved image-assisted job-search feature MAY accept standalone PNG and
  JPEG files only as ephemeral search-query inputs. Such inputs MUST NOT become
  CV uploads, Candidate Profile content, application artifacts, or persistent
  search-index data. Source images and derived OCR text MUST be validated,
  excluded from ordinary logs, purpose-limited, and deleted within a short hard
  deadline defined and verified by the approved feature specification.
- Secrets and production personal data MUST NOT be committed to the repository,
  written to ordinary application logs, or sent to an AI provider unless
  required for the approved feature and protected by the defined data policy.
- Consent, purpose limitation, disclosure, retention, and deletion MUST comply
  with applicable Vietnamese personal-data requirements, including Decree
  13/2023/ND-CP.

**Rationale:** SmartHire stores sensitive candidate and company information.
Working functionality does not compensate for broken authorization, privacy, or
tenant isolation.

### Principle III - Deterministic Core and Explainable AI

Business-critical behavior MUST remain predictable when the AI service is slow,
unavailable, or uncertain.

- Candidate scoring MUST use the approved hybrid formula:

  `Final Score = 40% × Deterministic Matching Score + 60% × AI Score`

- Deterministic matching MUST evaluate structured job criteria, including
  required skills and relevant experience.
- The AI component MAY provide semantic interpretation and explanation, but it
  MUST NOT silently remove or redefine mandatory job criteria.
- Score bands MUST use the approved thresholds: 80–100 High Match, 60–79 Medium
  Match, and below 60 Low Match.
- AI scoring MUST run asynchronously. The user interface MUST NOT block while
  waiting for an AI result.
- AI scoring MUST complete within 20 seconds under documented normal test
  conditions.
- When the AI service is unavailable, application processing MUST continue with
  deterministic matching where applicable, and the reduced-capability result
  MUST be clearly identified.
- An approved image-assisted job-search feature MAY use OCR and AI to transform
  user-provided text or image content into schema-validated search keywords and
  structured filters. AI MUST NOT directly select, exclude, or rank job
  identifiers; deterministic job retrieval and ranking MUST remain authoritative.
- AI-generated search filters MAY be applied automatically only when they are
  simultaneously visible, editable, removable, and reversible by the user.
  Manual text search and deterministic filtering MUST remain available when OCR
  or AI is unavailable, slow, or uncertain.
- The applicable model/provider, OCR engine/model, prompt or instruction
  version, parser or search-intent schema version, and relevant input-policy
  version MUST be traceable for each AI-assisted result. Scoring results MUST
  additionally retain their weights and thresholds. Traceability MUST NOT require
  retaining an ephemeral raw search image or its OCR text beyond its approved
  retention deadline.
- A specification or plan MUST NOT change the 40/60 weights, score bands, or
  human-override rule without first amending this constitution.

**Rationale:** The deterministic component provides stability, testability, and
a safe fallback; AI is reserved for semantic value that rules alone cannot
provide.

### Principle IV - State, Audit, and Data Integrity

The database is the authoritative source of recruitment state.

- Critical writes MUST use transactional operations and preserve referential
  integrity.
- Duplicate applications, duplicate notifications, and duplicate critical
  records MUST be prevented through constraints or idempotency controls.
- The canonical application states are **Applied, Viewed, Shortlisted,
  Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted**.
- The Hired state MUST only be set by an explicit Recruiter confirmation action,
  which triggers the hiring confirmation email. A candidate's in-app offer
  acceptance MUST only notify the recruiter and MUST NOT set Hired automatically.
- Every allowed state transition MUST be explicitly defined and validated on the
  server.
- The Kanban interface MUST NOT bypass state-transition, authorization, or
  persistence rules.
- Client-side optimistic updates MUST reconcile with the server and MUST recover
  visibly when persistence fails.
- Database migrations that can affect existing data MUST define a safe migration
  or recovery path.
- Critical events MUST be auditable, including authentication events, employer
  verification, job-post approval, account suspension, pipeline transitions,
  exports, and AI-processing failures.
- Audit records MUST identify the actor, action, target, result, and timestamp
  without storing unnecessary personal data.
- Job-post editing MUST retain the latest approved edit history rule: the most
  recent pre-edit state or complete latest change set together with its edit
  timestamp.

**Rationale:** A successful interface action is not valid if it produces an
unauthorized, duplicated, inconsistent, or unrecoverable system state.

### Principle V - Scope Discipline and Complete P0 Workflows

SmartHire MUST prioritize complete core recruitment workflows over optional
feature breadth.

- Every implemented feature MUST correspond to an approved SmartHire user need
  or requirement.
- A P1 feature MUST NOT displace an incomplete P0 workflow.
- A P0 feature MUST include the necessary user interaction, authorization,
  business rules, persistence, error handling, and verifiable acceptance
  behavior.
- AI MUST be used only where it provides material semantic value over a simpler
  deterministic method.
- Removed or deferred capabilities MUST NOT re-enter the product implicitly
  through a later specification or plan.
- External dependencies MUST have a defined purpose, failure behavior, and
  replacement boundary.

**Rationale:** A small number of complete, trustworthy workflows provides more
value than many disconnected demonstrations.

### Principle VI - Measurable Quality and Accessible Experience

Quality claims MUST be verifiable under stated conditions. Unless an approved
feature specification defines a stricter percentile, the latency targets in the
table below MUST be evaluated at the 95th percentile (P95) over a documented,
representative test window. This percentile convention is the project SLA
baseline because it resists isolated network, scheduling, and cold-start jitter
while still measuring sustained user experience.

| Interaction                          |                  Mandatory target |
| ------------------------------------ | --------------------------------: |
| Page load                            |                   P95 ≤ 3 seconds |
| Dashboard navigation                 |                   P95 ≤ 2 seconds |
| Job search and filtering             |                   P95 ≤ 2 seconds |
| Profile update                       |                   P95 ≤ 2 seconds |
| Kanban visual response               |            P95 ≤ 500 milliseconds |
| In-app notification                  |                   P95 ≤ 5 seconds |
| AI semantic scoring                  | P95 ≤ 20 seconds and asynchronous |
| Image-assisted search interpretation | P95 ≤ 10 seconds and asynchronous |
| Export up to 10,000 records          |                  P95 ≤ 10 seconds |

- The job-search-and-filtering target measures deterministic query execution
  after a text query or validated search intent is available. OCR and AI search
  interpretation use their separate target and MUST NOT block or disable manual
  search while processing.
- Each performance claim MUST identify its environment, dataset, measurement
  method, sample size, test duration, concurrency, percentile calculation,
  maximum observed latency, error rate, and relevant external-service
  conditions.
- P95 applies only to latency/service-level measurements. Authorization,
  validation correctness, transactional integrity, privacy, retention/deletion
  deadlines, and any requirement explicitly identified as a hard deadline MUST
  still pass for every tested case.
- The 99.5% availability figure MUST be treated as a design target unless it is
  measured over a defined deployment period.
- Candidate workflows MUST support responsive mobile use and clearly preserve
  or recover progress when long forms or unstable networks are involved.
- Recruiter and Administrator workflows MUST support data-dense desktop use,
  clear filtering, and visible system states.
- User interfaces MUST provide readable typography, sufficient contrast,
  keyboard-accessible controls, descriptive labels, and meaningful loading,
  success, validation, and error feedback.
- Color MUST NOT be the only means of communicating a score, state, success, or
  failure.

**Rationale:** P95 is the standard SmartHire latency SLA because a transparent
percentile captures sustained experience more honestly than a brittle maximum.
Numeric targets without test conditions or outlier/error reporting are not
evidence, and a workflow that excludes supported users is incomplete.

### Principle VII - Maintainable and Provider-Independent Architecture

The implementation MUST preserve clear boundaries between presentation,
business rules, persistence, and external services.

- The primary frontend MUST use Next.js and TypeScript with the approved
  Tailwind CSS and shadcn/ui baseline.
- Zustand MAY be used for documented non-sensitive shared client state, but it
  MUST NOT be required for every functional group.
- Authentication credentials, session tokens, passwords, TOTP secrets, backup
  codes, verification tokens, and password-reset tokens MUST NOT be stored in
  Zustand or other client-side state stores.

- Backend endpoints MUST use the approved Next.js server-routing mechanism
  defined in the active architecture baseline.
- The approved mechanism MAY use App Router Route Handlers under
  `app/api/**/route.ts` or Pages Router API Routes when explicitly documented.
- The same endpoint MUST NOT be implemented using both routing mechanisms.
- A separately approved realtime transport MAY be the sole exception to the
  Next.js routing requirement when a long-lived WebSocket or equivalent
  connection cannot be hosted correctly by the selected Route Handler,
  serverless, or edge runtime. The exception MUST use a documented long-lived
  Node custom-server entrypoint, MUST attach the realtime gateway to the same
  HTTP server and application process as Next.js unless a later architecture
  amendment explicitly authorizes another topology, and MUST NOT move ordinary
  REST/backend HTTP endpoints out of Next.js routing.
- A realtime custom server MUST remain transport composition only. It MUST
  delegate ordinary HTTP requests to Next.js, authenticate through the one
  approved browser-session mechanism, and call the same typed authorization,
  service, persistence, audit, and privacy boundaries as Route Handlers. It MUST
  NOT become a second backend service, database authority, or business-logic
  layer.
- Backend code MUST preserve layered separation between transport handlers,
  services, and repositories or data-access code.

- Persistent domain data MUST use PostgreSQL as the single approved relational
  production database unless this constitution is intentionally amended.
- Database access MUST preserve transactional integrity, referential integrity,
  duplicate prevention, and safe migration or recovery behavior.

- SmartHire MUST use exactly one exclusive server-controlled browser-session
  mechanism.
- Browser session credentials MUST be stored only in cookies configured with
  `HttpOnly`, `Secure` in production, and an appropriate `SameSite` policy.
- Browser session credentials MUST NOT be stored in `localStorage`,
  `sessionStorage`, Zustand, TanStack Query caches, or other persistent
  client-side state.
- The approved browser-session mechanism MAY use opaque database-backed
  sessions, signed cookie sessions, or JWT-based sessions, provided that it
  satisfies Principle II.
- The session mechanism MUST support server-side validation, expiration,
  revocation, logout, account-state enforcement, password-reset revocation,
  and security-event auditing.
- The application MUST NOT operate two independent browser-session mechanisms
  simultaneously.
- The implementation plan MUST identify the exclusive session owner and
  describe session creation, expiration, revocation, and persistence behavior.
- JWTs MAY be used for explicitly documented service-to-service authorization,
  but they MUST NOT create a second browser-session mechanism.

- Shared API inputs and outputs MUST be typed and validated at server trust
  boundaries.

- Business logic MUST NOT depend directly on a specific AI, email, file-storage,
  authentication, or other external-service provider.
- The implementation plan or an approved Architecture Decision Record MUST
  select each initial provider or library and preserve a replaceable service
  boundary.

- Email, file storage, authentication, AI, and other external-service failures
  MUST NOT corrupt core recruitment data or disable unrelated workflows.

- Presentation, business logic, data access, authentication integration, and
  external-service integration MUST remain loosely coupled.

- Replacing an implementation library, provider, ORM, routing mechanism,
  directory structure, or equivalent technical mechanism MUST NOT require a
  constitutional amendment when all constitutional product, security, privacy,
  data-integrity, and quality requirements remain satisfied.
- Technology-specific selections MUST be documented in the active
  architecture baseline, implementation plan, or an Architecture Decision
  Record.

**Rationale:** Stable architectural boundaries allow later specifications and
plans to change providers, libraries, routing mechanisms, session
implementations, or other technical details without rewriting the recruitment
domain or weakening mandatory security and quality properties.

## Mandatory Product Boundaries

### Target and actors

- SmartHire MUST remain an AI-assisted applicant tracking and recruitment
  management platform for Vietnamese small and medium enterprises, especially
  organizations of approximately 10–500 employees.
- The supported actors are Candidate, Recruiter/HR Manager, and Platform
  Administrator.
- Every normal account MUST retain a base Candidate identity.
- Recruiter/HR Manager authority MUST be granted through an approved company
  membership rather than a single global recruiter role on the user record.
- Employer privileges MUST require verified business information and
  Administrator approval. OAuth alone MUST NOT grant employer privileges.

### P0 capabilities

The following capabilities MUST be treated as P0:

- authentication, authorization, and access control;
- candidate profile and CV management;
- job board, search, filtering, and job applications;
- job-post creation and lifecycle management;
- candidate-side application tracking;
- hybrid candidate screening and scoring;
- recruitment pipeline and Kanban state management;
- status-triggered email and in-app notifications;
- job-post moderation and quality assurance;
- user management and employer verification.

Account enrichment, recruitment analytics, and data export remain P1 unless the
approved product baseline is amended.

### Explicit exclusions and restrictions

- AI-generated job descriptions MUST NOT be included in the current MVP.
- AI resume rewriting or enhancement MUST NOT be included because it can
  misrepresent a candidate's qualifications.
- Gap analysis MUST NOT be implemented as a separate feature; relevant strengths
  and gaps belong in the score explanation.
- Job retrieval, ranking, and recommendations MUST use approved deterministic
  matching. AI MUST NOT directly select, exclude, or rank job identifiers.
- Job search MUST be case-insensitive and Vietnamese-diacritic-insensitive.
- An approved image-assisted job-search feature MAY use OCR and AI to derive
  schema-validated keywords and structured filters from user-provided text or
  PNG/JPEG search inputs. These filters MAY be applied automatically only when
  they are simultaneously visible, editable, removable, and reversible;
  deterministic search MUST remain authoritative. The search MUST return only
  job records the actor is authorized to access and MUST NOT expose private
  candidate, application, or company data. Other AI-generated search keywords
  and LLM-based semantic job recommendations remain outside scope.
- A full user-facing Administrator activity-history feature MAY remain optional,
  but the backend audit events required by Principle IV are mandatory.

## Spec Kit Compliance Gates

Every generated artifact MUST apply this constitution as follows:

- A specification MUST define behavior consistent with the actors, P0/P1 scope,
  exclusions, canonical states, human authority, and privacy boundaries above.
- A plan MUST resolve the database and AI-provider choices, describe security and
  tenant enforcement, preserve fallback behavior, and identify how mandatory
  quality targets will be verified.
- A task list MUST include the work required for authorization, validation,
  persistence integrity, AI fallback and explanation, auditability, accessibility,
  and relevant tests whenever those concerns apply to the feature.
- A specification that permits OCR or AI-assisted search MUST define
  purpose-specific input types, validation, isolation, provenance, retention and
  deletion, visible user controls, deterministic fallback, provider boundaries,
  and measurable quality gates.
- A Constitution Check MUST treat any unresolved conflict with `MUST` or
  `MUST NOT` as blocking.
- A plan MUST NOT weaken a constitutional principle merely to simplify
  implementation. The specification, plan, or constitution MUST be corrected
  explicitly.

## Governance

This constitution supersedes conflicting statements in older proposals,
discussion notes, and superseded requirement drafts. The latest consolidated
Vision Document and detailed requirements remain supporting references where
they do not conflict with this constitution.

- Amendments MUST be intentional, documented in this file, and accompanied by a
  version change.
- A constitutional amendment MUST propagate to affected Spec Kit specifications,
  plans, tasks, checklists, and templates before further implementation based on
  the changed rule.
- Versioning follows semantic versioning: **MAJOR** for removal or incompatible
  redefinition of a principle, **MINOR** for a new principle or materially
  expanded mandatory rule, and **PATCH** for clarification without semantic
  change.
- Compliance MUST be checked when generating or updating a specification, plan,
  or task list.

**Version**: 2.3.0 | **Ratified**: 2026-07-11 | **Last Amended**: 2026-08-26
