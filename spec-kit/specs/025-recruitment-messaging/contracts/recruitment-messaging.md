# Contract: Recruitment Messaging

- `GET /api/recruiter/messages`: authorized HR/Recruiter list with bounded company/job/stage/assignment filters and safe summaries.
- `GET /api/candidate/applications/{applicationId}/recruitment-thread`: Candidate thread projection; a Candidate without assignment receives safe `NOT_ASSIGNED`.
- `POST /api/recruitment-threads/{threadId}/messages`: CSRF/idempotency-protected normalized text; server validates current application, assignment, membership, and state.
- `POST /api/recruiter/applications/{applicationId}/recruitment-thread/assignment`: CSRF-protected HR Manager-only assignment or reassignment to an active same-company HR Manager or Recruiter.
- `POST /api/recruiter/applications/{applicationId}/recruitment-thread`: CSRF-protected staff-only `Message candidate` command. It requires a non-terminal application at `VIEWED` or later, creates and self-assigns exactly one thread, and otherwise returns the existing thread without changing its assignee.
- `GET /api/recruitment-threads/{threadId}`: Candidate, assigned recruiter, HR Manager, or Owner detail; each route independently checks current company scope. Owner reads are audited and never update recipient state.
- `GET /api/recruitment-threads/{threadId}/assignees`: active HR Manager-only same-company assignment choices.
