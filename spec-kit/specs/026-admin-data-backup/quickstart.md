# Quickstart: Administrator Data Backup

1. Configure `BACKUP_ENCRYPTION_KEY`, `GOOGLE_DRIVE_BACKUP_FOLDER_ID`, and the selected Google Drive credential secret outside source control.
2. Add `http://127.0.0.1:3002/oauth2/callback` to the SmartHire OAuth web client's Authorized redirect URIs, then run `npm.cmd run backup:authorize-google --workspace @smarthire/web` once. Sign in to the Drive owner account and approve access; the script creates the ignored token JSON file.
3. For the configured OAuth adapter, share or select a folder in the Drive owner's My Drive; do not use a service-account key.
4. If this database already applied the pre-standardized migration names, run `npm.cmd run db:migrations:reconcile --workspace @smarthire/web` once.
5. Run migrations, then start `npm run admin:worker --workspace @smarthire/web`.
6. Sign in to the Admin Console with fresh two-factor proof, open Backup Settings, set 10 seconds, and save.
7. Select Run backup now and verify a successful history row with a Drive locator, checksum, and byte count. Confirm an encrypted artifact appears in the configured folder.

## Validation record

- 2026-08-21: `prisma generate`, `prisma validate`, and TypeScript typecheck passed.
- 2026-08-21: `git diff --check` passed.
- 2026-08-21: live OAuth Drive smoke test passed. The worker created a timestamp-and-admin-ID subfolder, uploaded an encrypted PostgreSQL dump, and stored the Drive folder/file IDs, byte count, and checksum in `BackupRun`.
- Production build is blocked while the user-owned development server holds the Next output lock (`NEXT_OUTPUT_IN_USE`). Stop that server before rerunning `npm.cmd run build --workspace @smarthire/web`.
