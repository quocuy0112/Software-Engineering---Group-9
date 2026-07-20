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
- CV uploads MUST be limited to PDF and DOCX files with a maximum size of 5 MB,
  unless this constitution is amended.
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

  `Final Score = 60% × Deterministic Matching Score + 40% × AI Score`

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
- The model/provider, prompt or instruction version, parser version, score
  weights, thresholds, and relevant input version MUST be traceable for each AI
  result.
- A specification or plan MUST NOT change the 60/40 weights, score bands, or
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
- The Hired state MUST only be set by an explicit Recruiter confirmation action (triggering the hiring confirmation email) - never automatically from a candidate's in-app offer acceptance, which MUST only notify the recruiter.
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

Quality claims MUST be verifiable under stated conditions.

| Interaction                 |              Mandatory target |
| --------------------------- | ----------------------------: |
| Page load                   |                   ≤ 3 seconds |
| Dashboard navigation        |                   ≤ 2 seconds |
| Job search and filtering    |                   ≤ 2 seconds |
| Profile update              |                   ≤ 2 seconds |
| Kanban visual response      |            ≤ 500 milliseconds |
| In-app notification         |                   ≤ 5 seconds |
| AI semantic scoring         | ≤ 20 seconds and asynchronous |
| Export up to 10,000 records |                  ≤ 10 seconds |

- Each performance claim MUST identify its environment, dataset, measurement
  method, and relevant external-service conditions.
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

**Rationale:** Numeric targets without test conditions are not evidence, and a
workflow that excludes supported users is incomplete.

### Principle VII - Maintainable and Provider-Independent Architecture

The implementation MUST preserve clear boundaries between presentation,
business rules, persistence, and external services.

- The frontend MUST use Next.js and TypeScript with the approved Tailwind CSS,
  Shadcn UI, and Zustand stack unless this constitution is amended.
- Backend APIs MUST use Next.js API Routes with a layered separation between
  routes/controllers, services, and repositories or data-access code.
- Persistent domain data MUST use one relational database. The implementation
  plan MUST select PostgreSQL before database implementation; it
  MUST NOT leave both as simultaneous production choices.
- Authentication MUST use JWT-based sessions implemented according to Principle
  II.
- Shared API inputs and outputs MUST be typed and validated at trust boundaries.
- Business logic MUST NOT depend directly on one AI provider. The implementation
  plan MUST select the initial provider/model and preserve a replaceable AI
  service boundary.
- Email, file storage, AI, and other external-service failures MUST NOT corrupt
  core recruitment data or disable unrelated workflows.
- Presentation, business logic, data access, and external-service integration
  MUST remain loosely coupled.

**Rationale:** Stable boundaries allow later specifications and plans to change
providers or implementation details without rewriting the recruitment domain.

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
- Job recommendations MUST use approved deterministic tag and location matching,
  not LLM-based semantic recommendations.
- Job search MUST be case-insensitive and Vietnamese-diacritic-insensitive.
  AI-generated search keywords are outside the current scope.
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
