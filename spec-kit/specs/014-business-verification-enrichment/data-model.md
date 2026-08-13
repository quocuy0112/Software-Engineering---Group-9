# Data Model: Business Verification Enrichment

## Enums

### BusinessRegistryLookupOutcome

`MATCHED`, `PARTIAL`, `NOT_FOUND`, `UNAVAILABLE`

### CompanyEmailChallengeState

`PENDING`, `VERIFIED`, `CONSUMED`, `SUPERSEDED`, `EXPIRED`

### EmployerApplicantRelationship

`LEGAL_OWNER`, `AUTHORIZED_EMPLOYEE`, `INVITED_MEMBER`, `EXISTING_OWNER_APPROVAL`, `OTHER`

## EmployerVerificationPreparation (new)

One mutable, server-side, recoverable draft per Candidate. It is not an authority request.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Primary key |
| `applicantUserId` | String | Unique active Candidate owner; cascade on account deletion |
| `lookupSnapshotId` | String? | Current immutable snapshot; applicant-bound |
| `version` | Int | Starts at 1; increments on every accepted mutation |
| `applicantLegalName` | String? | Normalized plain text, 1-240 |
| `applicantRegisteredAddress` | String? | Normalized plain text, 5-500 |
| `operatingAddressDiffers` | Boolean | Defaults false |
| `operatingAddress` | String? | Required only when differs; normalized 5-500 |
| `companyPhoneE164` | String? | Canonical `+84...`; syntax-only |
| `websiteOrigin` | String? | Canonical HTTPS origin |
| `relationship` | Enum? | Approved relationship enum |
| `currentJobTitle` | String? | Normalized 2-120 |
| `authorityExplanation` | String? | Normalized 20-500 when required |
| `mismatchExplanation` | String? | Normalized 20-500 when required |
| `updatedAt` | DateTime | Server update time |
| `expiresAt` | DateTime | Sliding 48-hour preparation lifetime |
| `inaccessibleAt` | DateTime? | Set on expiry/final submission |
| `deleteAfter` | DateTime? | At most 24 hours after inaccessible |
| `deletedAt` | DateTime? | Cleanup marker |

Constraints/indexes: unique `applicantUserId`; index `(expiresAt, inaccessibleAt)` and `(deleteAfter, deletedAt)`.

The preparation response may include current safe lookup facts and a masked email status. It never returns token digest, full token, outbox recipient ciphertext, raw provider data, or administrator-only representative information.

## BusinessRegistryLookupSnapshot (new)

Immutable result of one admitted lookup.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Opaque primary key |
| `applicantUserId` | String | Candidate owner; restrict-delete while accepted |
| `normalizedTaxIdentifier` | String | Exactly ten ASCII digits |
| `providerKey` | String | `vietqr-v2` or `disabled-manual-v1` |
| `outcome` | Enum | Lookup outcome |
| `registryLegalName` | String? | Allowlisted normalized provider value, max 240 |
| `registryInternationalName` | String? | Allowlisted normalized value, max 240 |
| `registryShortName` | String? | Allowlisted normalized value, max 160 |
| `registryRegisteredAddress` | String? | Allowlisted normalized value, max 500 |
| `registryEstablishedAt` | DateTime? | Null for initial provider unless supplied in a later validated contract |
| `registryLegalStatus` | String? | Admin projection only when supplied |
| `registryEntityType` | String? | Admin projection only when supplied |
| `registryRepresentativeName` | String? | Admin-only; never required from applicant |
| `responseDigest` | String | SHA-256 of canonical accepted fields/outcome |
| `checkedAt` | DateTime | Provider/fallback decision time |
| `expiresAt` | DateTime | `checkedAt + 30 minutes` |
| `acceptedRequestId` | String? | Unique owning request after final submission |
| `acceptedAt` | DateTime? | Set atomically with request creation |
| `inaccessibleAt` | DateTime? | For unused expiry/cleanup |
| `deleteAfter` | DateTime? | Unused snapshot deletion deadline |
| `deletedAt` | DateTime? | Cleanup marker |
| `createdAt` | DateTime | Insert time |

Constraints/indexes: unique `acceptedRequestId`; index `(applicantUserId, normalizedTaxIdentifier, expiresAt)`; index `(expiresAt, acceptedRequestId, inaccessibleAt)`; index `(deleteAfter, deletedAt)`.

Matched snapshots require legal name and registered address. A valid response missing either maps to `PARTIAL`. `NOT_FOUND` and `UNAVAILABLE` store no fabricated registry facts.

## CompanyContactEmailChallenge (new)

One single-use company mailbox proof bound to the current applicant and snapshot.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Primary key |
| `applicantUserId` | String | Candidate owner |
| `lookupSnapshotId` | String | Bound immutable snapshot |
| `normalizedTaxIdentifier` | String | Copied binding, exactly ten digits |
| `normalizedEmail` | String? | Canonical email; nulled during privacy scrub |
| `emailDigest` | String | HMAC lookup/audit binding; not reversible |
| `tokenDigest` | String? | Unique SHA-256/HMAC digest; nulled on terminal state |
| `state` | Enum | Challenge lifecycle |
| `expiresAt` | DateTime | At most 24 hours after issue |
| `verifiedAt` | DateTime? | Successful same-account confirmation |
| `consumedAt` | DateTime? | Final request acceptance |
| `supersededAt` | DateTime? | New binding/resend |
| `sensitiveInaccessibleAt` | DateTime? | Immediate terminal-state scrub time |
| `sensitiveDeleteAfter` | DateTime? | Within 24 hours of terminal state |
| `metadataDeleteAfter` | DateTime | Content-free metadata retained at most 30 days |
| `outboxId` | String? | Unique relation to verification email |
| `createdAt`, `updatedAt` | DateTime | Server timestamps |

Constraints/indexes: unique non-null `tokenDigest`; unique `outboxId`; index `(applicantUserId, lookupSnapshotId, state)`; index `(expiresAt, state)`; index `(sensitiveDeleteAfter)`; index `(metadataDeleteAfter)`.

State transitions:

```text
PENDING --confirm--> VERIFIED --final-submit--> CONSUMED
PENDING --resend/change--> SUPERSEDED
PENDING/VERIFIED --deadline--> EXPIRED
```

Only one current `PENDING` or `VERIFIED` challenge is allowed for the applicant/snapshot binding. Confirmation atomically claims the token digest and state. `VERIFIED` remains usable only until the earlier of challenge expiry, 24 hours after `verifiedAt`, or snapshot expiry.

## VerificationBusinessFacts (new)

Immutable one-to-one enriched facts accepted with a new Feature 014 request.

| Field | Type | Rules |
|---|---|---|
| `requestId` | String | Primary/foreign key to `RecruiterVerificationRequest`; cascade |
| `lookupSnapshotId` | String | Unique accepted snapshot relation |
| `applicantLegalName` | String | Normalized 1-240 |
| `applicantRegisteredAddress` | String | Normalized 5-500 |
| `operatingAddress` | String? | Normalized only when different |
| `companyEmail` | String | Verified canonical email |
| `companyEmailVerifiedAt` | DateTime | Challenge verification time |
| `companyEmailFreeProvider` | Boolean | Non-decisive signal |
| `companyEmailWebsiteDomainMatch` | Boolean? | Null when no website |
| `emailSignalVersion` | String | Versioned deterministic rules |
| `companyPhoneE164` | String | Canonical +84 form |
| `companyPhoneVerified` | Boolean | Always false in Feature 014 |
| `websiteOrigin` | String? | Canonical HTTPS origin |
| `relationship` | Enum | Applicant declaration |
| `currentJobTitle` | String | Normalized 2-120 |
| `authorityExplanation` | String? | Required conditionally |
| `legalNameDiffers` | Boolean | Exact normalized comparison |
| `registeredAddressDiffers` | Boolean | Exact normalized comparison |
| `mismatchExplanation` | String? | Required when either differs |
| `accuracyDeclaredAt` | DateTime | Accepted final submission time |
| `documentConsentAt` | DateTime | Accepted final submission time |
| `policyVersion` | String | Version of declaration/consent copy |
| `normalizationVersion` | String | Version of canonicalization rules |
| `createdAt` | DateTime | Accepted transaction time |

Constraints/indexes: unique `lookupSnapshotId`; index `(companyEmailFreeProvider, companyEmailWebsiteDomainMatch)` for bounded admin filters only if required by implemented UI.

Registry fields remain on the accepted immutable snapshot and are joined only for authorized administrator detail. Applicant/list responses do not receive representative information.

## RecruiterVerificationRequest (extended)

Add optional one-to-one `businessFacts`. Existing lifecycle columns and state transitions are unchanged.

New submissions require facts in service code. Legacy rows with no facts remain valid historical requests and render `legacyRequest=true`; they are not backfilled with invented verification data.

## EmailOutbox (extended)

- Add `COMPANY_EMAIL_VERIFY` to `EmailKind`.
- Add optional `companyEmailChallengeId` relation/index.
- Payload contains only challenge reference, display-safe company name when available, expiry, locale, and fragment-link builder inputs. Recipient uses the existing protected recipient fields.
- Idempotency key binds challenge ID and send generation.

## Active Request Uniqueness

PostgreSQL partial unique index:

```sql
CREATE UNIQUE INDEX "RecruiterVerificationRequest_active_applicant_tax_key"
ON "RecruiterVerificationRequest" ("applicantUserId", "normalizedTaxIdentifier")
WHERE "state" IN ('PENDING_CHECKS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED');
```

A verification script fails deployment when legacy data violates the invariant. The migration never deletes or merges requests.

## Transaction Boundaries

### Issue challenge

1. Lock/read current preparation and snapshot.
2. Supersede and schedule scrub for prior active challenges.
3. Create challenge digest and outbox row with one idempotency key.
4. Link outbox and commit.

### Confirm challenge

1. Resolve token digest without logging raw token.
2. Atomically update one `PENDING`, unexpired, same-applicant/current-snapshot row to `VERIFIED`.
3. Schedule token digest scrubbing and return masked current status.

### Final submission

1. Validate session, normalized payload, preparation version, snapshot, verified challenge, company/prerequisite, and evidence before authoritative writes.
2. Store encrypted evidence bytes through the existing adapter.
3. In one database transaction, claim active-request uniqueness, consume challenge, accept snapshot, create request, facts, evidence metadata, and one receipt outbox row, then make preparation inaccessible.
4. Delete newly stored evidence if the database transaction fails.

## Retention and Deletion

- Unused snapshot: expires after 30 minutes, inaccessible no later than 24 hours after expiry, deleted no later than 24 hours after becoming inaccessible.
- Preparation: expires after 48 hours without activity or immediately after final submission; inaccessible content is deleted within 24 hours.
- Challenge: normalized email and token digest inaccessible immediately on consumed/superseded/expired and physically nulled/deleted within 24 hours; content-free delivery/security metadata deleted within 30 days.
- Accepted snapshot/facts: follow the owning Feature 006 request's authorized review/history retention. They are never exposed through public or unrelated tenant paths.
