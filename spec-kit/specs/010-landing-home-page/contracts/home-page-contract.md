# Home Page Interface Contract

## Composition contract

| Interface | Contract |
| --- | --- |
| Home context composition | Reads the existing valid session, safe account projection, bounded public jobs, genuine existing candidate match when eligible, independent safe public company projections, and recruiter status. Returns one Home model and maps optional source failures to local section states. |
| Shared Home view | Renders one ordered structure for guest, candidate, employer, and expired-session states. Only authorized account controls, shortcuts, employer action, save state, and genuine/illustrative match presentation vary. |
| Home localization | Owns every Home-authored visible and assistive string for `vi` and `en`, plus in-memory search values. It never owns credentials, session references, grants, private records, or authorization results. |

## Existing session contract

- Better Auth remains the exclusive browser-session owner; its Prisma adapter
  persists opaque sessions in PostgreSQL and its configured HttpOnly,
  SameSite=Lax, environment-Secure cookie is the only browser credential.
- Home resolves the session once through `requireSession()` and never reads or
  stores the opaque token in client state, storage, URLs, or output.
- Missing, revoked, provider-expired, absolute-expired, idle-expired, inactive-
  account, and blocking recovery/reset states resolve to Guest presentation.
- Logout uses existing `POST /api/identity/logout` with origin/CSRF validation,
  Better Auth sign-out/cookie clearing, and `logout.succeeded` auditing. Policy
  rejection retains existing `session.revoked` audit behavior.

## Existing product boundaries reused unchanged

| Need | Existing destination or capability | Required Home behavior |
| --- | --- | --- |
| Explore/search jobs | `/jobs` and existing job discovery | Forward only the allowed validated criteria. Home shows no more than six public job cards. |
| Job detail | `/jobs/[slug]` | Primary interactive job-card destination. |
| Save job | Existing saved-job behavior | Guest uses safe authentication handoff; authenticated action prevents duplicate activation and restores state after failure. |
| Create Profile | `/register` for guest or `/profile` for authenticated candidate | No new registration or profile workflow. |
| Logout | Existing logout behavior | Successful logout resolves Home to guest; failure is localized and recoverable. |
| Candidate shortcuts | `/dashboard`, `/jobs/applied`, `/jobs/saved` | Existing destinations remain authorization authority. |
| Post a Job | Existing recruiter-status-resolved state and destination | Home never guesses a company, grant, posting URL, or workspace URL. |

## Hero search handoff

The final Home UI supports all and only these controls:

| Home control | Allowed job-discovery criterion |
| --- | --- |
| Keyword | `q` (maximum 200 characters) |
| Location | `location` (maximum 160 characters) |
| Work arrangement | validated `workArrangement` value(s) |
| Employment type | validated `employmentType` value(s) |
| Experience level | validated `experienceLevel` value(s) |
| Skills | validated `skills` value(s), maximum 80 characters per skill |

- Switching `vi`/`en` preserves every entered value and selection.
- Unknown keys and invalid values are rejected.
- Language, session, role, membership, recruiter status, score, mock-content ID,
  and all other Home presentation data are never forwarded.

## Smart Match contract

Home Smart Match is a candidate-facing job-fit recommendation over public jobs.
It is not applicant screening, never ranks candidates for employers, and does
not replace or alter the separate constitutional 40/60 applicant-screening
formula.

| Viewer/result state | Smart Match section | Job-card score |
| --- | --- | --- |
| Authenticated candidate with sufficient existing profile signals and a valid existing result | Genuine existing deterministic/profile-backed result with source kind `personal`, matching skills, improvement areas, limitations, and estimate wording | May be shown only for a job with a valid current-candidate personal score |
| Authenticated candidate with insufficient data or unavailable result | Clearly labelled illustrative result with source kind `illustrative` | Omitted |
| Guest | Clearly labelled illustrative result | Omitted |
| Employer presentation | Clearly labelled illustrative result with no candidate profile signals | Omitted |

Home does not calculate a new score, change matching rules, persist matching
data, or copy an illustrative score onto job cards. Every score is an estimate or
recommendation, never a hiring decision.

## Employer Spotlight public projection

Employer Spotlight is independent from the six Trending Opportunities cards.

| Field | Public projection rule |
| --- | --- |
| Public company identity | Required for a ready card and supplied by existing authorized public data |
| Public brand summary | Optional `publicDescription`; never relabel it as verified work culture |
| Culture and Hybrid/Mentoring/Internship-friendly badges | Omitted because the current schema has no authoritative public fields for these claims |
| Open-position count | Optional; include only when supplied by an authoritative complete count, never by counting Home job cards |
| Destination | `display-only` for Feature 010 because no confirmed existing public company detail route is in scope |

If a required public identity cannot be projected safely, omit the card. If no
card remains, use the localized section empty state. Source failure produces a
localized section error and never falls back to invented company data.

The repository selects only active verified companies and the allowlisted
fields `slug`, `displayName`, `logoUrl`, `publicDescription`, `publicLocation`,
`industry`, and `size`. If implemented, `openPositionCount` uses a filtered
relation count over all active, approved, published, non-expired public jobs.
This is an internal read-only projection; Feature 010 adds no company API.

## Navigation and content destination contract

| Home item | Destination behavior |
| --- | --- |
| Explore Jobs | `/jobs` |
| Career Community | `#community` |
| Companies | `#employer-spotlight` |
| Events | `#events` |
| Job card | `/jobs/[slug]` |
| Candidate shortcuts | Existing routes listed above |
| Post a Job | Existing recruiter-status-resolved destination only |
| Feed, Career Path, Growth Hub, Event cards | Display-only; no link or simulated action |
| Employer Spotlight cards | Display-only; no link until an existing public company destination is separately confirmed |
| Footer | Valid existing routes or the matching Home anchors only |

## Localization contract

One centralized Home catalog provides both Vietnamese and English for:

- navigation, footer, headings, eyebrow text, body copy, labels and buttons;
- search labels, placeholders, option labels, and submit feedback;
- accessible names for navigation, language, account, avatar, save, and mobile menu;
- loading, empty, error, scoped recovery, and full Home reload labels;
- account-required, logout, and save success/failure feedback;
- personal/illustrative source labels, match-score labels, and limitation text;
- display-only labels.

Underlying job and company record text remains outside Home localization.

## State and privacy contracts

- Dynamic jobs and company sections each provide localized loading, empty, and
  non-technical error states.
- Recovery is scoped to the failed source when available. A whole-page recovery
  is labelled “Reload Home” (or its Vietnamese equivalent), never “Retry”.
- A jobs failure and a company failure are independent and cannot disable
  header, hero, search, logout, or curated sections.
- Expired session presentation becomes guest and removes identity, shortcuts,
  saved state, personal match, membership, and private identifiers.
- Guest account-required actions explain the requirement in the selected
  language before or as part of the safe authentication handoff.
- No guest or expired-session output contains private profile email, profile
  signals, application data, membership data, tokens, session identifiers,
  security proofs, or raw errors.

## Visual and accessibility contract

- The Smart Hire Home uses one typography scale and consistent section rhythm,
  card spacing, control sizing, line heights, radii, shadows, and hierarchy.
- Desktop, tablet, mobile, and 200% zoom avoid horizontal scrolling, overlap,
  clipped focus, and cramped account/search controls.
- Compact navigation supports keyboard activation, Escape, focus containment
  and restoration, and correct expanded state.
- Semantic landmarks and heading hierarchy are preserved; focus is visible;
  color is not the sole state indicator; reduced motion is respected.
