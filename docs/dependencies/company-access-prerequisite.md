# Company access prerequisite dependency

Existing-company approval is fail-closed until the invitation/OWNER-approval
producer declares `ADMIN_COMPANY_PREREQUISITE_READY=true` and passes the
consumer contract in the target environment. The deployment record must also
set non-empty `ADMIN_COMPANY_PREREQUISITE_OWNER` and
`ADMIN_COMPANY_PREREQUISITE_VERSION` values.

The upstream owner must publish a versioned record scoped to one applicant,
one company, one requested role, and—when OWNER approval is used—one
verification request. It must expose current expiry, revocation, and
consumption state atomically. Tax-identifier matching is never a substitute.
