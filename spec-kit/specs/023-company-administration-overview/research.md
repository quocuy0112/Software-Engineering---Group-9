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
