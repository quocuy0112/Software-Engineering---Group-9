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

## Administrator Review Search Addition

| Entity | New field / projection | Rule |
|---|---|---|
| `JobPostReviewVersion` | `normalizedTitleSearch` text | Derived from immutable `snapshot.title` by trim, whitespace collapse, Unicode lowercasing, and Vietnamese-diacritic removal. It is search-only and never displayed as source content. |
| Review-search backfill | Idempotent command/migration step | Processes existing rows in batches, deriving `normalizedTitleSearch` from their snapshot; preserves snapshot, state, history, and versions. |
| Search query | `q` plus normalized tokens | `q` remains bounded to 160 characters; 1–8 non-empty tokens are ANDed within a searchable name/title projection. Exact IDs and tax codes remain equality conditions. |
