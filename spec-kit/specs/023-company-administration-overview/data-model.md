# Data Model: Company Administration Overview

No migration is required. The overview derives a safe read projection from existing records.

| Projection | Source | Bounded fields |
|---|---|---|
| Company identity | `Company` | ID, legal/display names, verification state and timestamps |
| Membership health | `CompanyMembership` | status counts, active-owner count, five latest safe rows |
| Verification summary | `RecruiterVerificationRequest` | count and latest request ID/state/timestamps |
| Activity summary | `JobPosting`, `JobPostReviewAggregate`, `ModerationReport` | counts only |
| Access audit | `AuditEvent` | actor/session/action/company target/result/timestamp and empty context |

The access audit uses action `admin.company_detail_viewed` and target type `company`. It contains no tax identifier, email, document, note, or response payload.
