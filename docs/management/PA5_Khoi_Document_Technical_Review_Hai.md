# PA5 Technical Review of Khôi-Owned Synchronization Work

*Reviewer: Lưu Chí Hải | Document owners/correction owner: Nguyễn Minh Khôi | Date: 2026-08-26*

**Task:** HAI-11  
**Result:** Partially completed — artifacts were reviewed, but approval is withheld pending Khôi corrections. This file records findings only and does not transfer authorship.

## Review basis

The review compared Khôi-owned outputs with the Feature Inventory, SpecKit 001–026, application routes/components, backend services, `web/prisma/schema.prisma`, tests, root `compose.yaml`, and `docs/testing/PA5_Testing.md`. Existing “Reviewed by: Lưu Chí Hải” and “Approved” labels dated 2026-08-26 were present before this review and must not be treated as Hải approval where findings below remain unresolved.

## Findings by task

| Khôi task | Reviewed artifacts | Result | Evidence-backed finding / required owner correction |
|---|---|---|---|
| KHOI-02 | Khôi-owned Vision NFR, scope, dependencies, AI/release qualification | Corrections required | Recent administrator step-up is 15 minutes in `admin-request-boundary.ts`, `/api/admin/auth/step-up`, and auth-context route, not 10. The NFR also says platform `ADMIN` role, while authorization is based on `PlatformAdministratorGrant` plus designated session/scopes. Backup text claims local persistent backup plus optional Drive, but current `BackupService` uploads the encrypted result through the Google Drive adapter and records Drive metadata; local persistent backup/retention is not represented in the schema/service. Performance/capacity/WCAG/SUS/coverage numbers must be labeled acceptance targets and not claimed as verified without execution evidence. |
| KHOI-03 | DGM-04 and `04_Administration_Moderation.md` | Corrections required | UC-ORG-06 assigns company-profile edits only to Owner/HR Manager, but `updateRecruiterCompanySettings()` currently authorizes through `authorizedCompanies()` without a matching role-specific edit check; document actual behavior or flag the authorization gap instead of asserting stricter policy. DGM/spec currently claim Hải review/Approved before resolution. Recheck requested-role coverage including `HIRING_MANAGER` and align UC-ORG numbering with Vision traceability. |
| KHOI-04 | DGM-06 and `06_Analytics_Platform_Administration.md` | Critical corrections required | `/admin-console/analytics` and `/admin-console/audit-logs` are not Next.js pages. Admin analytics is composed inside the React Admin console and API `/api/admin/analytics/overview`; repository search found correlation/rationale audit endpoints, not a general searchable audit-log viewer. `UC-ADM-01` therefore lacks UI/service proof as written. Export status names must match `QUEUED/LEASED/SUCCEEDED/FAILED/EXPIRED/DELETING/DELETED`, and the fixed “24 hours”, “10,000 records/10 seconds”, local-only artifact flow, and broad audit claims need direct evidence or qualification. |
| KHOI-05 | DGM-07 and `07_Admin_Backup.md` | Critical corrections required | Backup UI is one React Admin resource in `/admin-console`, not separate `/admin-console/backup`, `/settings`, or `/history` pages. Step-up window is 15 minutes, not 10. Schema statuses are `QUEUED`, `LEASED`, `SUCCEEDED`, `FAILED`; `Local_Success_Cloud_Failed` and `Success/In_Progress` are unsupported. Configuration stores only `enabled` and `intervalSeconds`, not cron/daily/weekly retention/destination/notification recipients. Current service does not retain a local dump after Google upload, and no backup-specific email/in-app alert producer or retention purge was found. Keep the correct no-restore-UI boundary. |
| KHOI-06 | `container_diagram.md` | Corrections required | Logical worker processes are supported by scripts, but deployable/container wording must distinguish them from root Compose services. Current Compose includes `postgres`, `clamav`, `cv-worker`, `ocr-engine`, `image-search-worker`, and `admin-worker`; it does not include web, email, export, or a separate backup-runner service. Container diagram also labels recruitment messaging as part of Socket.IO traffic indirectly; current recruitment threads are REST/refetch. |
| KHOI-07 | `backend_component_diagram.md` | Critical corrections required | The Socket.IO gateway description explicitly says it manages “application recruitment threads”; architecture tests/service design keep recruitment messaging separate and REST-only. Step-up is 15 minutes, not 10. “Immutable audit log exploration” is not backed by a general audit-log viewer. Separate backup/export worker deployment must be qualified as executable scripts/logical processes, not current Compose services. |
| KHOI-08 | `deployment_diagram.md` | Critical corrections required | Lines 15 and 159 say no root `compose.yaml` exists, but the current tracked root manifest defines six services. The diagram must map those actual Compose services and qualify host processes. `localhost:3001`, PostgreSQL port claims, all-nodes-on-one-machine, local backup path, and final demo topology require current environment/demo evidence. Attribution says Hải reviewed/Approved although this review rejects the baseline. |
| KHOI-10 | DGM-01 and `01_Identity_Access_Profile.md` | Reviewed with follow-up | DGM-01 correctly keeps F001 verification pending and Feature 027 outside scope. Before final approval, ensure AUTH-06/AUTH-08 remain linked to open bugs and no route-return behavior is described as verified. Khôi's review attribution is his own; no Hải approval is needed for this review-only task, but consolidated integration waits for the corrected Khôi domains above. |

## Cross-document corrections required

1. Replace premature `Reviewed by: Lưu Chí Hải` / `Approved` labels on KHOI-03–08 with `Review pending` until Khôi applies corrections and Hải rechecks the diffs.
2. Use a 15-minute recent administrator two-factor proof consistently.
3. Represent Platform Administrator authority through the grant/designated-session boundary, not a user/company `ADMIN` role.
4. Represent recruitment messaging as REST/refetch and general messaging as Socket.IO plus REST recovery.
5. Use root `compose.yaml` as current evidence; distinguish its six services from logical/executable host processes.
6. Remove unsupported backup retention/destination/status/alert/local-store claims and unsupported admin audit-log UI claims.

## Review status

- Technical review performed: Yes.
- Owner corrections complete: No.
- Hải approval: No.
- Ready for consolidated Use-Case Model, final Vision integration, aggregate PA5 Changes, or PDF freeze: No.
