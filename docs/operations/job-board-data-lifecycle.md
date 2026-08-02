# Job Board Data Lifecycle

This runbook covers the Job Board & Advanced Search feature: public discovery,
job details, saved jobs, reports, and candidate applications.

## Ownership and visibility

- Only approved, published postings belonging to a verified company enter the
  public projection. Pending, rejected, removed, private, and unknown postings
  share the same neutral unavailable behavior.
- Public list/detail responses never include recruiter contacts, moderation
  state, reports, applications, candidate data, or company-private fields.
- Saved jobs are keyed by the authenticated user and posting. Create and remove
  are idempotent; ownership is never accepted from request input.
- Reports are private to authorized moderation workflows. Public and company
  job-board projections cannot read reporter identity, reason, or details.
- Applications, answers, selected CV metadata, and snapshots are visible only
  through later authorized candidate/recruiter workflows. This feature does not
  expose a general application-read endpoint.

## Write invariants

- Protected mutations require the existing Better Auth session, an active
  account, same-origin validation, and the session-bound CSRF proof.
- A user can have one saved relationship per posting, one unresolved report per
  posting/reason, and one application per posting.
- Reports begin in `PENDING_REVIEW`. Submission records an audit event but never
  changes the posting; only a later authorized human moderation workflow may do
  so.
- Applications begin in canonical stage `APPLIED`. The serializable transaction
  rechecks posting eligibility, profile completeness, confirmed CV ownership,
  active questions, answers, consent, duplicates, and idempotency binding.
- Application, answers, bounded profile/CV/job snapshots, audit evidence, and
  two notification-work records commit atomically. Notification delivery occurs
  later and cannot reverse a committed application.

## Privacy, retention, and deletion

- Report details and application free text are normalized to bounded plain text.
  Audit context excludes report text, answers, CV contents, credentials, and
  unnecessary personal data.
- Unresolved report uniqueness uses a keyed digest. Rate limiting uses the
  existing database bucket with a privacy-preserving subject digest.
- Account suspension or deletion immediately blocks authenticated access.
  Retained application, report, notification, and audit evidence follows the
  project's approved legal retention/deletion process; no ad-hoc cleanup command
  should bypass that process.
- When an approved physical deletion is performed, delete dependent notification
  work and answers before applications. Shared companies, postings, and skills
  must not cascade from candidate deletion.

## Migration and rollback

The feature is introduced by
`web/prisma/migrations/008_job_board_advanced_search/migration.sql`. It creates
the `pg_trgm` extension, enums, tables, constraints, and indexes used by public
search and protected actions.

Validate before deployment:

```bash
npm run db:validate
npm run db:verify
npm run db:status --workspace @smarthire/web
```

Use forward corrective migrations in shared environments. Do not manually drop
job-board tables or run `db:reset` against retained data. If application rollout
must be reversed, roll back the application version while leaving compatible
tables intact, then ship an approved forward migration.

## Verification and performance

Run focused tests with `npm run test:job-board`. Integration and E2E suites need
the local PostgreSQL service and an initialized `web/.env.local`.

The performance harness makes one warm-up and 100 measured requests for search,
detail, and an authenticated save/remove action. Run a production build on the
configured base URL and supply an opaque test posting plus an ephemeral test
session through environment variables:

```text
PERF_JOB_SLUG
PERF_JOB_ID
PERF_SESSION_COOKIE
PERF_CSRF_TOKEN
PERF_BASE_URL (optional; defaults to http://localhost:3001)
PERF_ITERATIONS (optional; defaults to 100)
```

Then run `npm run perf:job-board`. The script emits aggregate timing only and
does not print the session cookie or CSRF proof. Each p95 budget is 2,000 ms.
