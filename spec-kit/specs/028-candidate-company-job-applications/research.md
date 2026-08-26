# Research: Candidate Company and Team Applications

## Decisions

### Keep ordinary job applications separate from Team Applications

**Rationale**: Candidates can browse every active public job on a company page, but applying to an ordinary job already has a complete job-detail/application/pipeline workflow. Team Applications have a different purpose: joining the company as HR Manager or Recruiter and waiting for an Owner invitation.

**Alternatives considered**: A single application entity and shared pipeline were rejected because they would mix company membership decisions with ordinary hiring workflows and introduce unwanted scoring/pipeline behavior.

### Use two explicit entry points on the company detail page

**Rationale**: A visible team-application action supports candidates seeking HR Manager or Recruiter membership, while the Jobs section lets other candidates search and open ordinary job details. The distinction makes the consequences of each action clear.

**Alternatives considered**: Treating HR Manager/Recruiter as ordinary jobs was rejected because the outcome is company membership invitation rather than a normal job application.

### Derive company size from active employee membership count

**Rationale**: The requested company size should reflect the current company state and avoid a manually maintained duplicate value. The public projection returns a defined range and an unavailable value when count data is not available.

**Alternatives considered**: Owner-entered size was rejected as stale and inconsistent with the requested employee-count basis; exposing an exact count was rejected as unnecessary public detail.

### Use a separate TeamApplication entity with immutable CV evidence

**Rationale**: Team applications need a company/role decision lifecycle and must not affect ordinary job application stages or scoring. The submitted CV must remain the evidence reviewed by the Owner even if the candidate later changes their profile.

**Alternatives considered**: Reusing `JobApplication` was rejected because it would couple membership invitation decisions to pipeline/scoring state; linking only to the candidate’s current CV was rejected because it would change historical evidence.

### Reuse CompanyInvitation and create membership only after acceptance

**Rationale**: Existing invitation semantics already support role-bound, expiring, revocable invitations and membership creation after explicit acceptance. Team application acceptance should create one invitation and use the same safe acceptance boundary.

**Alternatives considered**: Adding membership immediately after Owner acceptance was rejected because it grants access without candidate consent; sending an untracked email was rejected because it cannot provide idempotency or auditability.

### Rejection email is mandatory; reason is optional

**Rationale**: Candidates receive a definitive outcome, while Owners retain control over whether to provide useful feedback. The email must never expose internal notes or unauthorized company information.

**Alternatives considered**: No email was rejected as opaque; mandatory detailed feedback was rejected because Owners may not have a safe or appropriate reason to disclose.

### Keep Owner review lightweight and human-controlled

**Rationale**: The feature explicitly excludes scoring, AI recommendations, and pipeline/Kanban. The Owner reviews the CV and makes the decision, while the system handles authorization, persistence, notification, and invitation mechanics.

**Alternatives considered**: Automatic role assignment, AI screening, and a second pipeline were rejected by the feature scope and constitution’s human-control requirement.
