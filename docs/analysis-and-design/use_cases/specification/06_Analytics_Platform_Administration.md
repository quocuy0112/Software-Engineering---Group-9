# DGM-06 — Use-Case Specification: Analytics, Export, and Platform Administration

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*  
**Version:** V1.0 (2026-08-26) — Created for PA5 Final Document Synchronization

### Revision History

| Version | Date | Author/Editor | Summary | Status |
|---|---|---|---|---|
| 1.0 | 2026-08-26 | Nguyễn Minh Khôi | Created complete use-case specifications for Company Recruitment Analytics, Background Data Export (CSV/Excel), Platform Overview Analytics, and Audit Logging (Features 006, 009, 022). | Approved |

The Mermaid source is maintained in [diagram_06.md](../diagrams/diagram_06.md). Company Member and Platform Administrator generalize Authenticated User. Recruiter, HR Manager, and Company Owner generalize Company Member.

---

# UC-ANL-01 — View Company Recruitment Analytics

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-ANL-01 |
| Primary Actor | Recruiter, HR Manager, Company Owner |
| Supporting Actor | None |
| Trigger | The user navigates to the recruitment analytics dashboard (`/recruiter/analytics` or `/recruiter/analytics/[jobId]`). |

## Brief Description

This use case allows an authorized company recruiter, HR manager, or owner to view aggregated recruitment metrics and pipeline funnel analytics scoped to their active company. Metrics include total views, application conversion rates, stage breakdown across the 9-stage pipeline, average time-to-hire, and candidate sourcing channels.

## Actors

- Recruiter
- HR Manager
- Company Owner

## Preconditions

### Active Company Membership
The User has an authenticated session with an `Active` `CompanyMembership` for the company whose analytics are requested.

## Flow of Events

### Basic Flow — View Company Overall Analytics

1. The use case begins when the user navigates to `/recruiter/analytics`.
2. The System validates the user's company membership and permissions.
3. The System computes aggregated metrics from PostgreSQL:
   - Total job postings (Active, Closed, Draft);
   - Total applications received and distribution across 9 pipeline stages;
   - Application velocity and conversion rate (Applied → Shortlisted → Interviewing → Offered → Hired);
   - Average days in each pipeline stage.
4. The System renders visual charts (funnel charts, time-series graphs, and summary metric cards).
5. The user selects a date range filter (e.g., last 7 days, 30 days, 90 days, or custom).
6. The System recalculates and refreshes the charts within 2 seconds (P95).
7. The use case ends.

## Alternative Flows

### A1 — View Job-Specific Analytics
1. At Basic Flow step 1, the user selects a specific job posting (`/recruiter/analytics/[jobId]`).
2. The System verifies the job posting belongs to the user's active company.
3. The System filters application funnels, candidate drop-off points, and score distributions specifically for that job.
4. The flow resumes at Basic Flow step 4.

## Exception Flows

### E1 — Unauthorized Access to Cross-Company Metrics
1. At Basic Flow step 2, if the user attempts to access analytics for a company where they lack an active membership:
2. The System denies access, returns HTTP `403 Forbidden`, and logs the unauthorized attempt to the audit log.
3. The use case ends.

## Special Requirements

### Multi-Tenant Isolation
All metric aggregation queries must strictly filter by `companyId`. Cross-tenant data leaks are strictly prohibited.

### Read Performance
Aggregated queries should utilize indexed fact tables and database views to ensure response times meet `PERF-02` (P95 ≤ 2s).

## Postconditions

### Success End Condition
The user views accurate, company-scoped recruitment metrics and charts.

### Failure End Condition
Access is denied; no company data is exposed.

---

# UC-ANL-02 — Request and Download Recruitment Data Export

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-ANL-02 |
| Primary Actor | HR Manager, Company Owner |
| Supporting Actor | Analytics Export Worker |
| Trigger | The user requests an applicant or recruitment data export. |

## Brief Description

This use case allows a Company Owner or HR Manager to request and download structured recruitment data (candidate lists, application histories, pipeline stage metrics) in CSV or Microsoft Excel (.xlsx) format. The export is processed asynchronously by the Analytics Export Worker to prevent blocking the UI, with temporary download links that expire after a configurable duration.

## Actors

- HR Manager
- Company Owner
- Analytics Export Worker

## Preconditions

### Authorized Role
The user holds an `Active` `CompanyMembership` with role `OWNER` or `HR_MANAGER`. (Base Recruiters are restricted from bulk data export to protect candidate privacy).

## Flow of Events

### Basic Flow — Generate and Download Export

1. The use case begins when the user clicks "Export Data" on the analytics or candidate list page.
2. The System displays an export modal allowing selection of format (CSV or Excel `.xlsx`), date range, target job posting(s), and data fields.
3. The user confirms the export request.
4. The System creates an `ExportRequest` record in PostgreSQL with status `Pending` and logs the export initiation in the audit log.
5. The Analytics Export Worker claims the pending job, extracts company-scoped candidate/application records, and generates the file using ExcelJS / CSV stream.
6. The worker saves the encrypted artifact to local private storage (`Local Export Store`), updates the `ExportRequest` status to `Completed`, and sets a download expiry deadline (default 24 hours).
7. The System displays a notification to the user with a secure, time-limited download link.
8. The user clicks the download link; the System validates the session, company scope, and expiration token, streaming the file over HTTPS.
9. The use case ends.

## Alternative Flows

### A1 — Export Generation Failure
1. If the worker encounters an error during file generation:
2. The worker marks the `ExportRequest` as `Failed`, records diagnostic error details, and notifies the user.
3. The user may retry the export request.

## Special Requirements

### Asynchronous Processing
Exports for up to 10,000 records must complete within 10 seconds (`PERF-08`) without blocking web server request threads.

### Retention & Expiry
Exported files are ephemeral and automatically purged from storage upon the expiration deadline.

### Auditability
Every export request, including actor, parameters, format, and download timestamp, is logged to the audit log.

## Postconditions

### Success End Condition
The user downloads the generated recruitment export file; the operation is recorded in the audit log.

### Failure End Condition
The export request fails or expires safely without corrupting data; the failure is logged and the user is informed.

---

# UC-ANL-03 — View Platform-Wide Overview Analytics

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-ANL-03 |
| Primary Actor | Platform Administrator |
| Supporting Actor | None |
| Trigger | The administrator navigates to the platform analytics overview in the Admin Console. |

## Brief Description

This use case allows a Platform Administrator to view system-wide operational metrics, including total registered candidates, verified vs pending companies, total active job postings, application throughput, system error rates, and worker health status.

## Actors

- Platform Administrator

## Preconditions

### Active Admin Grant
The User is authenticated and holds the platform `ADMIN` role.

## Flow of Events

### Basic Flow

1. The use case begins when the Administrator navigates to `/admin-console/analytics`.
2. The System verifies the user's platform `ADMIN` role.
3. The System compiles system-wide statistics across all tenants:
   - Total users by role (Candidates, Recruiters, Admins);
   - Verification queue depth (Pending company requests, pending job posts);
   - System error and worker throughput trends;
   - Daily active users and application submission volume.
4. The System displays interactive platform charts and summary KPIs.
5. The Administrator filters metrics by timeframe or system component.
6. The System refreshes the overview display.
7. The use case ends.

## Special Requirements

### Privacy Safeguards
Platform overview metrics present aggregated statistics without exposing candidate CV contents or private recruiter notes unless specifically accessed through authorized moderation workflows.

## Postconditions

### Success End Condition
The Administrator views platform health and aggregate activity metrics.

---

# UC-ADM-01 — View Platform Audit and System Activity Logs

*Performed by: Nguyễn Minh Khôi | Reviewed by: Lưu Chí Hải | Edited by: Nguyễn Minh Khôi*

## Use-Case Information

| Field | Value |
|---|---|
| Use-Case ID | UC-ADM-01 |
| Primary Actor | Platform Administrator |
| Supporting Actor | None |
| Trigger | The administrator opens the system audit log viewer (`/admin-console/audit-logs`). |

## Brief Description

This use case allows a Platform Administrator to search, filter, and inspect immutable audit trail logs, including authentication events, membership changes, moderation decisions, account suspensions, data exports, and backup runs.

## Actors

- Platform Administrator

## Preconditions

### Active Admin Grant
The User is authenticated and holds the platform `ADMIN` role.

## Flow of Events

### Basic Flow

1. The use case begins when the Administrator navigates to `/admin-console/audit-logs`.
2. The System queries audit log entries from PostgreSQL with pagination (default 50 records per page).
3. The Administrator applies filters by event type (e.g. `AUTH_LOGIN`, `COMPANY_VERIFY`, `JOB_MODERATE`, `ACCOUNT_SUSPEND`, `BACKUP_RUN`), actor email/ID, target resource ID, or date range.
4. The System returns filtered audit records showing timestamp, actor, action, IP/client info, and metadata payload diffs.
5. The Administrator clicks a record to inspect the full JSON event context.
6. The use case ends.

## Special Requirements

### Immutability
Audit log records are append-only; modification or manual deletion via API or web interface is strictly disallowed.

## Postconditions

### Success End Condition
The Administrator reviews historical system activity logs for security auditing and compliance.
