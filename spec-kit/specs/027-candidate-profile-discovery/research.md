# Research: Candidate Profile Discovery and Recruiter Review

## Decisions

### Keep discovery independent from messaging eligibility

**Rationale**: `/people/[userId]` currently uses `PrismaMessagingEligibilityRepository.findEligibleProfile`, permitting only accepted professional connections or application-messaging relationships. A new profile-access service must enforce discovery policy without granting messaging.

**Alternatives considered**: Extending messaging eligibility was rejected because it implies private messaging rights. A public people directory was rejected by scope and privacy requirements.

### Persist a one-to-one visibility policy

**Rationale**: `CandidateProfile` already owns live professional fields but not disclosure. `CandidateProfileVisibility` adds default-hidden exact-ID discovery, separate strict section sets for Candidate and Recruiter audiences, versioning, and timestamps without copying personal data.

**Alternatives considered**: Sixteen booleans on the profile were rejected as brittle; a stored public projection was rejected as stale duplicated data.

### Reuse recruiter application authority

**Rationale**: `RecruiterApplicationAuthorization.authorizeApplication(userId, jobId, applicationId)` verifies active account, verified company, eligible membership, active/closed job, and application ownership. The existing candidate drawer already has both identifiers.

**Alternatives considered**: `/people/[userId]` and company-only checks were rejected because they cannot enforce application/job tenancy.

### Reuse immutable application evidence and gate contact at read time

**Rationale**: `JobApplication` already stores profile/CV/job/contact snapshots and immutable documents. The recruiter view reads immutable evidence while calculating current live profile disclosure each request. It uses `contactSnapshot` only with active consent, never `UserAccount.email` or an unredacted profile snapshot.

**Alternatives considered**: Current-profile evidence and second document storage were rejected because they mutate history or duplicate protected content.

### Persist application-owned revocable consent

**Rationale**: A one-to-one consent record captures grant/withdraw times and a version, defaults to no disclosure, and supports audit. The initial checkbox travels through application submission; the candidate can later withdraw consent.

**Alternatives considered**: Global profile consent and endpoint-only hiding were rejected because consent varies by application and current recruiter lists/rankings otherwise leak contact data.

### Extend rate-limit storage through a purpose-specific admission service

**Rationale**: Existing `RateLimitBucket`, rate-limit policies, and `NetworkSourceProtector` safely digest account/network values and support atomic increments. This feature additionally needs unsuccessful-only hourly tracking and a durable 15-minute block, so a dedicated repository operation must enforce `blockedUntil`.

**Alternatives considered**: CUID entropy and IP-only limits were rejected because IDs are not secrets and either approach leaves enumeration paths.

### Extend the application retention worker

**Rationale**: Existing application retention already governs document access. Add snapshot-review due/denied fields and process them in the same worker, preserving minimal audit data and legal holds.

**Alternatives considered**: Indefinite snapshot retention and deleting whole applications were rejected by retention and audit requirements.
