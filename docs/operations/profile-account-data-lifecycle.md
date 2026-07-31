# Profile and account data lifecycle

Feature 002 adds candidate profile, self-service identity, preference,
email-change, and password-change records. It does not add account deletion,
public/recruiter profile publication, administrator editing, or a new
retention-expiry engine. Current soft deletion and every future physical
deletion remain governed by SmartHire's approved privacy, legal-hold,
retention, deletion, and least-privilege policies.

## Current lifecycle

`UserAccount.state = DELETED` with `deletedAt` is the current account-level
soft-delete boundary. Existing authorization rejects the account immediately
while its records remain available only to approved operational/legal
processes. Feature 002 exposes no hard-delete API or UI and operators must not
simulate one with ad hoc SQL.

No Feature 002 record receives a new automatic retention deadline merely
because this feature exists. The policy owner must define and approve any
expiry or anonymization schedule before an implementation is added.

| Data                                                 | Ownership and current behavior                                                       | Future physical-delete boundary                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `UserAccount` / Better Auth credential and sessions  | Existing identity owner; soft deletion makes protected data inaccessible             | Only an approved account-deletion workflow                                                                     |
| `CandidateIdentity`                                  | One per candidate and `RESTRICT`-linked to the user                                  | Must be explicitly addressed before a physical user delete                                                     |
| `CandidateProfile`                                   | One-to-one child of `CandidateIdentity`                                              | Cascades only when its candidate identity is physically removed                                                |
| Experience, education, selected skills, social links | Profile-owned children                                                               | Cascade with the physical profile deletion                                                                     |
| `Skill`                                              | Shared normalized catalog                                                            | Never cascades when one profile or selection is removed                                                        |
| `AccountPreferences`                                 | Account-owned settings                                                               | Cascades only with an approved physical user deletion                                                          |
| `EmailChangeRequest`                                 | Account-owned, 30-minute proof validity; historical status remains policy-controlled | Cascades only with an approved physical user deletion; referenced outbox rows remain independent               |
| Password attempt window and operation                | Account-owned security state and durable milestones                                  | Cascade only with an approved physical user deletion; linked notification/audit records are not owned children |
| `EmailOutbox`                                        | Durable delivery intent with protected recipient/payload fields                      | User/security-token FKs become null on referenced-row cleanup; the row remains subject to central retention    |
| `AuditEvent`                                         | Durable security evidence with scalar actor/target references                        | Preserved under the existing audit/legal policy; not cascaded from the user                                    |

Soft deletion does not trigger database cascades. The cascade/restrict behavior
above applies only to a future physical deletion.

## Future hard-deletion boundaries

A future approved hard-delete feature must be designed and reviewed separately.
At minimum, it must:

1. verify identity, authorization, legal hold, retention eligibility, and the
   exact user target;
2. revoke access and create a tested, access-controlled backup or export before
   destructive work;
3. explicitly remove `CandidateIdentity`, allowing its `CandidateProfile` and
   profile-owned children to cascade;
4. physically remove the user only after the `CandidateIdentity` restriction
   has been satisfied;
5. preserve shared `Skill` rows, durable `EmailOutbox` rows, and required
   `AuditEvent` evidence;
6. prove that `EmailOutbox.userId` and `securityTokenId` detach to null without
   changing the immutable delivery envelope; and
7. record only approved identifiers, counts, decisions, and timestamps in the
   deletion evidence.

This is a design boundary, not an executable runbook. No direct delete command
is authorized by this document.

## Shared skill retention

Deleting or replacing a profile's selected skill removes only its
`CandidateProfileSkill` association. The `Skill` row is shared and its FK uses
`RESTRICT`; one candidate must never remove catalog data used by another.

An optional orphan cleanup requires a separate retention-approved job. It must
identify zero-association rows, lock or otherwise serialize the final
association recheck, tolerate a concurrent selection, delete in bounded
batches, and report counts without profile contents. A read-only inventory may
use:

```sql
SELECT COUNT(*) AS "unreferencedSkillCount"
FROM "Skill" AS skill
WHERE NOT EXISTS (
  SELECT 1
  FROM "CandidateProfileSkill" AS selection
  WHERE selection."skillId" = skill."id"
);
```

This query does not authorize deletion.

## Audit and outbox preservation

The outbox delivery envelope is immutable after insertion: kind, recipient
reference/ciphertext/purpose, template version, payload, and idempotency key
cannot be retargeted. Only delivery lifecycle fields may change. The reviewed
forward migration
`20260731191000_preserve_outbox_on_fk_cleanup` additionally permits only a
non-null-to-null `userId` or `securityTokenId` transition caused by FK cleanup;
it still forbids retargeting or envelope edits.

Email-change and password-operation rows may reference outbox/audit results
with nullable links. Removing an owning operation does not delete the referenced
durable evidence. `AuditEvent.actorUserId` and target identifiers are not
cascading user FKs. Access, export, anonymization, and eventual expiry of these
records must follow the central audit/outbox retention policy.

Do not select or export `payloadRef`, protected proofs, recipient ciphertext,
recipient references, raw profile bodies, or security digests for routine
operations. Backups containing them are personal/security data and require the
same access controls, encryption, retention, and disposal as production.

## Migration backup and forward-fix procedure

Feature 002 uses reviewed forward-only migrations. Never edit an applied
Feature 001 migration, `007_candidate_profile_account_management`, or any later
applied migration.

Before deployment:

1. Confirm `npm ci`, `npm run env:check`, and `npm run db:validate` pass from
   the locked repository state.
2. Run `npm run db:verify`. It builds both a clean database and a Feature
   001-upgrade database, validates the profile backfill/counts and constraints,
   checks status/drift, then removes its explicitly named temporary databases.
3. Take an approved PostgreSQL physical snapshot or logical backup and perform
   a restore rehearsal in an isolated environment. Record the backup identity,
   database version, migration head, checksum, operator, and UTC time without
   putting credentials or personal rows in the change ticket.
4. Review the SQL for table rewrites, locks, backfill/count guards, FK actions,
   partial/unique indexes, CHECK constraints, and the outbox immutability
   trigger.
5. Stop or bound conflicting account/profile writes for the deployment window
   according to the database change plan.

Deploy with the approved production Prisma `migrate deploy` pipeline; use
`npm run db:migrate` only for the documented local development workflow. After
deployment, verify migration status, one profile per candidate identity,
registration, email-claim coordination, outbox FK cleanup, and application
health before reopening normal traffic.

If a migration fails:

1. stop further migration attempts and new Feature 002 writes;
2. preserve database logs and migration status using only secret-safe
   metadata;
3. determine whether the transaction rolled back or left an explicitly known
   partial state;
4. create and review a new timestamped forward-fix migration instead of
   rewriting applied SQL;
5. rerun clean and Feature 001-upgrade verification plus the affected
   constraint/integration suites; and
6. roll forward whenever accepted Feature 002 writes may exist.

Restore the tested pre-deployment backup only under the approved recovery
process when the exact restore boundary is known and no accepted post-backup
writes must be retained. Otherwise a restore would silently lose profile,
identity, security, audit, or outbox evidence and is not an acceptable
rollback.

## Data requests and incidents

Exports and privacy requests must use the established account-data process,
scope records to the authoritative account, and distinguish profile-owned data
from shared catalog data and security evidence. Never send database dumps,
captured email, protected recipients, proofs, or security-event details through
ordinary support channels.

For suspected disclosure, first preserve safe correlation/target identifiers
and counts, contain access, and notify the privacy/security incident owner.
Retention exceptions and legal holds override routine cleanup until the
authorized policy owner releases them.
