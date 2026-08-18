# Research: Company Administration Overview

## Decisions

- **One bounded overview projection**: The server constructs the company identity and all count/recent summaries in one repository operation using bounded aggregate queries.
  - **Rationale**: Avoids a client-side fan-out and prevents N+1 access patterns.
  - **Alternatives considered**: Several frontend requests were rejected because they duplicate authorization/loading state and create sequential load failures.

- **Access audit is mandatory**: The detail route records an immutable, metadata-only audit event after finding the company and before returning it.
  - **Rationale**: Company, verification, and membership information are privileged administration data.
  - **Alternatives considered**: Client telemetry and best-effort background writes were rejected because they cannot prove an authorized server-side access.

- **No company commands in P0**: The overview links the administrator to existing workflows only in future work; it owns no mutation.
  - **Rationale**: Suspend, owner assignment, and verification overrides need their own state-machine, step-up, rationale, and transactional policy.

- **MUI/React Admin presentation**: The page uses the existing React Admin `Show` integration and MUI `sx` styling.
  - **Rationale**: Preserves console theming, focus handling, and responsive behavior without global CSS.

- **Normalized token search for review titles**: Persist a normalized title-search projection on each `JobPostReviewVersion`; normalize query input with the same shared routine, then require every token to occur in the projection.
  - **Rationale**: Prisma's JSON `string_contains` filter is case-sensitive and provides inconsistent partial matching for a title stored inside the immutable review snapshot. A normal text projection makes `web`, `Web`, and `Web De` deterministic while keeping the snapshot immutable.
  - **Alternatives considered**: Client-side filtering was rejected because it breaks pagination and can hide valid results. Parameterized raw SQL over JSON was rejected because it adds database-specific query logic and is harder to keep consistent with the Prisma repository boundary.

- **Case- and diacritic-insensitive name matching**: Normalize whitespace, Unicode case, and Vietnamese diacritics; search each token with AND semantics within the company or applicant name field.
  - **Rationale**: Administrators can type prefixes and partial multi-word names without needing exact capitalization, spacing, or accents. Exact references and tax codes remain exact to preserve deterministic lookup behavior.
  - **Alternatives considered**: A single phrase `contains` query was rejected because it fails when spacing or partial terms differ. Full-text ranking was rejected because the requirement is deterministic filtering, not relevance ranking.
