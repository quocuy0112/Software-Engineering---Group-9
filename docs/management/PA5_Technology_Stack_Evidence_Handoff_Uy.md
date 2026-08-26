# PA5 Technology Stack Evidence Handoff to Nguyễn Gia Quốc Uy

*Prepared by: Lưu Chí Hải | Technology Stack edit owner: Nguyễn Gia Quốc Uy | Review: Pending Nguyễn Gia Quốc Uy and Nguyễn Minh Khôi*

**Date:** 2026-08-26  
**Task:** HAI-09 — evidence review/handoff only  
**Authority:** No repository or user evidence delegates Technology Stack editing authority to Hải. Therefore `docs/diagrams/system context diagram/tech_stack.md` was not modified.

## Current-state correction note

The earlier audit statement that no checked-in Compose manifest exists is now obsolete. The current branch tracks root `compose.yaml` (`git ls-files --stage -- compose.yaml`) and its history predates this synchronization session. It defines PostgreSQL, ClamAV, CV worker, OCR engine, image-search worker, and admin worker. No `compose.yml`, `docker-compose.yml`, or `docker-compose.yaml` was found.

## Evidence-backed review

| Location | Existing claim | Current repository evidence | Problem / qualification | Proposed correction for Uy |
|---|---|---|---|---|
| Lines 11–13, Architecture Overview | One Next.js web application; web and email worker run as host processes; PostgreSQL, ClamAV, CV worker, image-search worker, and OCR engine run in Compose. | `web/server.ts`; `web/package.json` includes `email:worker`; tracked `compose.yaml` defines `postgres`, `clamav`, `cv-worker`, `ocr-engine`, `image-search-worker`, and also `admin-worker`. | Compose portion is supported, but the list omits `admin-worker`. The repository alone does not prove which host processes were used in the final demo. | Add `admin-worker` to the Compose list. Qualify web/email as the documented local launch arrangement unless demo evidence confirms the actual final topology. |
| Lines 70–73, PostgreSQL 16.12 | `postgres:16.12` Docker Compose service. | `compose.yaml` pins `postgres:16.12`, health check, loopback host port, and named data volume. | Supported. | Retain; optionally cite root `compose.yaml` and avoid implying a cloud-managed production database. |
| Lines 105–109, ClamAV 1.4 | `clamav/clamav:1.4_base` Compose service, private socket, FreshClam. | `compose.yaml` pins the digest, mounts signature/runtime volumes and ClamAV configs, and CV/image/admin workers share the socket. | Supported. | Retain; clarify that freshness/runtime readiness still depends on the running environment. |
| Lines 133–137, Infrastructure / Docker Compose | Root `compose.yaml`. | Tracked root manifest exists and defines six services plus volumes. | Supported; earlier “manifest missing” finding must not be repeated. | Keep the claim and enumerate the six current services accurately. |
| Messaging sections | Socket.IO realtime messaging. | `web/server.ts`, messaging gateway/registries, `/chat` transport and `/chat`, `/connections`, `/support` namespaces; recruitment messaging service/routes use REST. | A generic realtime claim can wrongly include application-scoped recruitment messaging. | State that general messaging uses Socket.IO plus REST recovery; application-scoped recruitment threads use REST/refetch and are not on the chat gateway. |
| Backup sections | Encrypted PostgreSQL backup with Google Drive/local behavior. | `web/src/backend/backup/`, `admin-worker` Compose service, `BackupConfiguration`/`BackupRun`; Google Drive adapter exists. | Manual/scheduled/history/failure are supported. No restore UI exists. Final demo credentials/topology are not proven by source. | Describe Google Drive as an implemented adapter requiring runtime credentials; state explicitly that restore is out-of-band and demo provisioning remains to be verified. |
| Analytics/export sections | CSV/Excel export and private storage. | recruiter analytics/export UI/routes/services/worker/schema/tests; local/S3 artifact adapters. | Implementation evidence exists, but F022 is `Implemented; verification pending`. | Retain technology capability while recording final verification status and avoiding a “planned only” description. |
| Optional providers | OpenAI, VietQR, S3/KMS, Resend/SMTP, Google Drive. | Provider adapters/configuration/readiness checks exist in backend code. | Adapter existence is not proof of final demo provisioning. Capture/local adapters are not external systems. | Label each provider optional/configured as appropriate and separate adapter support from final environment provisioning. |

## Handoff Definition of Done

- Uy decides and applies any Technology Stack edits.
- Claims cite current root `compose.yaml` and applicable source/configuration.
- No external adapter is described as provisioned without environment/demo evidence.
- Messaging and backup protocol/scope boundaries agree with the final diagrams.
- Uy records his edit attribution; reviewer attribution is added only after actual review.

**Technology Stack was not modified.**
