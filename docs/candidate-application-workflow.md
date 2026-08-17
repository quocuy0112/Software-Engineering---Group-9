# Candidate application workflow

The candidate application flow is page-based:

- `/jobs/[slug]/apply` owns the resumable personal-information and files draft.
- `/jobs/[slug]/apply/review` builds a server-owned review projection and submits with a draft revision and idempotency key.
- `/jobs/applied/[applicationId]/processing` reads persisted technical intake progress.
- `/jobs/applied/[applicationId]` reads the allow-listed candidate tracker.

## Product field decision

The legacy apply modal's `Location` field and per-application SmartHire AI opt-in are intentionally not carried into this workflow.

`Location` is profile data, not a field in `CandidateApplicationDraft`; the review and submission paths source the candidate's current profile contact snapshot. Automated comparison is disclosed as uniform platform support, consistent with the feature constitution, and is not an application-level consent flag. No `location` or AI-opt-in value is accepted by the new draft or submit contracts.

CVs are selected only from the owned confirmed CV library or uploaded through the existing candidate-CV validation path. A cover letter is one discriminated draft field: either bounded text or one validated file descriptor. Intake progress is separate from canonical recruitment stage, and withdrawal records an orthogonal terminal outcome while preserving that stage.
