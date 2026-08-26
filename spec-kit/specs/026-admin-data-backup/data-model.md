# Data model: Administrator Data Backup

## BackupConfiguration

Singleton record (`id = "platform"`): `enabled`, `intervalSeconds`, `version`, `updatedByAdminUserId`, and timestamps. Interval is 10-86,400 seconds.

## BackupRun

One record per manual or scheduled attempt: `id`, trigger, state (`QUEUED`, `LEASED`, `SUCCEEDED`, `FAILED`), request/correlation identifiers, lease data, encrypted Drive locator, file name, SHA-256 checksum, bytes, timestamps, and a safe failure code. Unique active run is enforced through transaction/lease logic.
