# Quickstart: Recruitment Messaging Validation

1. Seed an active Candidate, company, active HR Manager/Recruiter membership, job, and application.
2. Open `/recruiter/messages` as an HR Manager, select the unassigned application, and assign an eligible staff member.
3. Candidate and assignee exchange messages in one job/company-labelled thread.
4. Reassign the application; verify history continues and the former assignee cannot send.
5. Filter Recruiter Messages by job/stage/assignment and verify no foreign-company data.
6. Open the same detail as Owner; verify audit exists but no compose/read receipt/unread mutation. Move the application terminal; verify read-only history.

```powershell
cd web
npm.cmd exec --workspace @smarthire/web vitest run tests/shared/unit/contracts/recruitment-messaging.test.ts
npm.cmd run typecheck
npm.cmd run db:validate
npm.cmd run db:migrations:check
```

`db:migrations:check` requires every migration directory to use the repository's
`NNN_snake_case` convention. Reconcile any locally generated timestamp-named
migration with its database migration-history entry before treating the feature
as fully validated.
