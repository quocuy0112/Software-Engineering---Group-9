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

Use `npm run db:down` to stop PostgreSQL while retaining the named volume. `npm run db:reset` deletes local database data and must be used only intentionally.

## Migration sequence normalization

The checked-in history is normalized to 51 contiguous migrations, from
`001_identity_foundation` through `051_private_match_retry_deterministic_pointer`.
The obsolete no-op `031_smarthire` entry was removed. The two timestamp-generated
index migrations were folded into `048_admin_timestamp_defaults_and_indexes`.

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

## Backup and restore

Before risky local experiments, use `docker compose exec -T postgres pg_dump` to create a logical backup outside the container. Restore into a newly created database with container-provided PostgreSQL tools. Never copy a live volume directory or commit dumps containing personal data or credentials.

## Production safety

- Never edit an applied migration or reset a production database.
- Review generated SQL for destructive statements, long locks, and required backfills before deployment.
- Prefer expand/migrate/contract changes for populated tables.
- If deployment fails, diagnose with `prisma migrate status` and produce a forward-fix migration.
- Use `prisma migrate resolve` only after confirming the exact database state and documenting whether a failed migration was rolled back or manually completed.
- Restore from a verified backup only under an approved recovery procedure.
