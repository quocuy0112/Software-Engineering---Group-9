# Database migration operations

SmartHire uses Prisma Migrate 7.7.0 against PostgreSQL 16.12. Run all commands from the repository root; workspace scripts execute Prisma from `web` and load the existing `.env.local` without overwriting it.

## Routine local workflow

```bash
npm run db:up
npm run env:check
npm run db:validate
npm run db:migrate
npm run db:verify
```

`db:verify` waits for Compose PostgreSQL, creates explicitly named temporary verification and shadow databases inside the container, applies every committed migration from empty, checks migration status and drift, executes a Prisma connectivity query, and removes the temporary databases. It never invokes host `psql`.

Use `npm run db:down` to stop PostgreSQL while retaining the named volume. `npm run db:reset` resets all local users' profile/application data and authentication state, removes admin grants/notifications and non-baseline review workflow data, and deletes company memberships. It also removes companies owned by the reset user (including their tax identifier) and jobs created by that user, together with their dependent applications, reports, messages, and review rows. A company where the user is only a member is preserved as shared data; only the user's membership and submitted verification evidence are removed. The shared job, company, and skill catalog plus imported review baselines remain intact. Memberships referenced by an imported baseline are retained to protect that baseline. It anonymizes and marks each account row deleted only to retain catalog foreign-key relationships, releasing previous emails for registration. Use `npm run db:reset:empty` only when you intentionally want to delete the entire local database. Run `npm run db:seed:jobs` separately when the local catalogue needs to be loaded or updated.

After an unqualified reset, create a new local account before provisioning an administrator grant with `npm run admin:provision -- user@example.com`. A reset targeted with an email or user ID removes only that account's administrator grant and preserves grants for other administrators.

## Migration sequence normalization

The checked-in history is normalized to 74 contiguous migrations, from
`001_identity_foundation` through `074_prisma_index_name_alignment`.
The obsolete no-op `031_smarthire` entry was removed. The post-064 migrations
from parallel feature branches were renumbered into one sequence; the duplicate
schema-alignment timestamp migration was folded into `068_prisma_schema_alignment`,
and the latest Prisma-generated index-name alignment is tracked as
`074_prisma_index_name_alignment`.

For a database that was initialized with the previous names, check and then
apply the migration-history reconciliation before running `prisma migrate deploy`:

```bash
npm run db:migrations:reconcile-names
npm run db:migrations:reconcile-names -- --apply
cd web
npm exec -- prisma migrate status
cd ..
```

The reconciliation updates only `_prisma_migrations`; it does not replay schema
SQL or modify application tables. Take a database backup and review the check
output before using `--apply` in a shared environment.

The root `npm run db:migrate` command performs the local reconciliation in apply
mode automatically after PostgreSQL is healthy, then runs `prisma migrate dev`.

## Backup and restore

Before risky local experiments, use `docker compose exec -T postgres pg_dump` to create a logical backup outside the container. Restore into a newly created database with container-provided PostgreSQL tools. Never copy a live volume directory or commit dumps containing personal data or credentials.

## Production safety

- Never edit an applied migration or reset a production database.
- Review generated SQL for destructive statements, long locks, and required backfills before deployment.
- Prefer expand/migrate/contract changes for populated tables.
- If deployment fails, diagnose with `prisma migrate status` and produce a forward-fix migration.
- Use `prisma migrate resolve` only after confirming the exact database state and documenting whether a failed migration was rolled back or manually completed.
- Restore from a verified backup only under an approved recovery procedure.
