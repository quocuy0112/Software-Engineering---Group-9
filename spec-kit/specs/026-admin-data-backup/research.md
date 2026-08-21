# Research: Administrator Data Backup

## Decision: Use a server-side Google Drive storage adapter

**Rationale**: A provider boundary keeps Google Drive credentials outside browser and domain layers and makes a future S3 replacement possible.

**Alternatives considered**: Browser upload is rejected because it exposes privileged credentials and cannot run on schedule.

## Decision: OAuth refresh token for the My Drive destination

**Rationale**: The configured 5 TB destination is personal My Drive. The worker refreshes an offline OAuth grant for that owning account and uploads only to its configured folder. The OAuth client secret and refresh token remain deployment secrets.

## Decision: Encrypt before upload and retain metadata only

**Rationale**: Drive access alone must not reveal a PostgreSQL dump. The database stores locator, checksum, byte count, and safe outcome, never dump content or credentials.

## Decision: Worker-owned schedule and lease

**Rationale**: A persistent worker continues after browser close/restart and a database lease prevents duplicate uploads across worker instances.
