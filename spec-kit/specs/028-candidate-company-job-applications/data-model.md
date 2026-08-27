# Data Model: Candidate Company and Team Applications

## Public company projection

This is a read projection of approved company data, not a duplicated public profile record.

| Field               | Rule                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| companyId           | Stable company identifier used for navigation and scoped queries                                                                       |
| name                | Public company name                                                                                                                    |
| logo                | Public logo or fallback                                                                                                                |
| description         | Public short/long description; unavailable state when absent                                                                           |
| foundedYear         | Optional; never inferred                                                                                                               |
| activeEmployeeCount | Derived from current active company memberships and never exposed unless policy allows                                                 |
| activeOwnerCount    | Internal derived count of active, non-removed `OWNER` memberships; team applications are available only when this is greater than zero |
| sizeRange           | Derived from active employee count using documented product ranges                                                                     |
| industry            | Optional public industry value                                                                                                         |
| location            | Optional public company location                                                                                                       |
| publicVisibility    | Only approved and publicly visible companies are included                                                                              |

The Company list accepts a bounded keyword query over safe public discovery
signals (company name, industry, public location, description, and public slug)
and returns a deterministic page ordered by display name and company id. The
page envelope contains `page`, `total`, and `totalPages`.

## Company job projection

| Field          | Rule                                                                 |
| -------------- | -------------------------------------------------------------------- |
| jobPostingId   | Existing job identifier/slug                                         |
| companyId      | Must equal the viewed company                                        |
| title          | Public job title                                                     |
| role           | Public role/title; ordinary jobs are not Team Applications           |
| location       | Public location used by the location filter                          |
| employmentType | Existing public employment information                               |
| status         | Only active, approved, publicly visible jobs                         |
| detailTarget   | Opens the existing job detail page and ordinary application workflow |

Company jobs are returned in deterministic pages with a default page size of 20. The job result envelope exposes the current page, total result count, and
total page count so the Candidate can move between pages without losing the
keyword or location filters. Job cards reuse the existing Find Jobs card and
status/action projection.

Keyword search uses the existing case-insensitive and Vietnamese-diacritic-insensitive normalization. Results must remain scoped to the selected company.

## TeamOpportunity

Represents the company’s lightweight invitation pathway, not an ordinary job post.

| Field                | Rule                                             |
| -------------------- | ------------------------------------------------ |
| id                   | Stable opaque identifier                         |
| companyId            | Verified company receiving the application       |
| role                 | Exactly `HR_MANAGER` or `RECRUITER`              |
| state                | Open or closed according to Owner/company policy |
| createdAt / closedAt | Lifecycle evidence                               |

The initial product may expose one open pathway per supported role; planning must decide whether these are generated from company membership capacity or stored as explicit opportunities without changing the candidate-facing behavior.

## TeamApplication

| Field                                                   | Rule                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| id                                                      | Stable opaque identifier                                                                               |
| candidateUserId                                         | Authenticated Candidate applicant                                                                      |
| companyId                                               | Target verified company                                                                                |
| teamOpportunityId                                       | Target HR Manager or Recruiter opportunity                                                             |
| appliedRole                                             | Immutable role selected by Candidate                                                                   |
| applicationEmail                                        | Normalized candidate account email used for decision notifications/invitation binding                  |
| cvArtifactId                                            | Immutable validated submitted CV evidence; PDF/DOCX, max 5,000,000 bytes                               |
| status                                                  | `SUBMITTED`, `VIEWED`, `REJECTED`, `INVITATION_SENT`, `WITHDRAWN`, or `JOINED`                         |
| rejectionReason                                         | Optional Owner-provided reason; candidate-facing only when explicitly included in rejection email      |
| submittedAt / ownerFirstViewedAt / decidedAt / joinedAt | Lifecycle timestamps; `ownerFirstViewedAt` is the first authorized Owner open of the application or CV |
| version                                                 | Optimistic concurrency/idempotency evidence                                                            |

Constraint: one active TeamApplication per candidate, company, and applied role. A TeamApplication does not create membership, invitation, scoring data, or ordinary pipeline stages.

The Candidate may see whether `ownerFirstViewedAt` is present and its date, but never sees Owner identity, view count, duration, internal notes, or audit payloads. Invitation expiration is read from the linked TeamInvitation and displayed separately from the TeamApplication decision status.

## TeamInvitation linkage

Reuse the existing CompanyInvitation model where possible. The invitation must reference the originating TeamApplication, target company, normalized candidate email, confirmed role, expiration, revocation/acceptance state, and one-time token digest. One accepted decision creates at most one active invitation for the application.

## CompanyMembership linkage

Existing CompanyMembership remains authoritative. Membership is created or reactivated only after valid invitation acceptance and is limited to the confirmed `HR_MANAGER` or `RECRUITER` role. Owner membership is not created by this feature.

## State transitions

```text
SUBMITTED ──Owner views──> VIEWED
SUBMITTED/VIEWED ──Owner rejects──> REJECTED
SUBMITTED/VIEWED ──Owner accepts──> INVITATION_SENT ──Candidate accepts──> JOINED
SUBMITTED/VIEWED ──Candidate withdraws──> WITHDRAWN
```

Every transition is authorized and validated server-side. Repeated accept/reject/withdraw commands must be safe and must not send duplicate notifications or create duplicate memberships.

## Owner delivery and locale projection

Before a candidate submits, the server rechecks that the target company is
approved, public, and has at least one active, non-removed `OWNER` membership.
This prevents an application from being created without a recipient. A company
without an active Owner may still expose its ordinary public jobs, but it does
not expose team-role actions.

After a successful submission, the transaction creates one
`TEAM_APPLICATION_RECEIVED` in-app notification per active Owner. The
deduplication key is scoped to the application and Owner. The notification
stores only a safe company/role summary and resolves to the Owner Team
Applications page; CV contents, applicant email, and other private evidence
remain outside the notification payload. Rendering uses each Owner's saved
English/Vietnamese preference.
