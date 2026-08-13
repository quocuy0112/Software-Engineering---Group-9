# Feature Specification: Smart Hire Home/Landing Page

**Feature Branch**: `010-landing-home-page`  
**Created**: 2026-08-12  
**Last Amended**: 2026-08-12  
**Status**: In Progress  
**Input**: Amend Feature 010 to close specification-to-implementation gaps while retaining one shared Home route and existing product workflows.

## Clarifications

### Session 2026-08-12

- Smart Match uses an existing deterministic, profile-backed, candidate-facing
  job-fit recommendation only for an authenticated candidate whose existing
  profile has sufficient signals. It ranks jobs for that candidate's own
  discovery experience and is not employer-facing applicant screening.
- Guests, employers, and candidates with insufficient or unavailable profile
  data receive clearly labelled illustrative Smart Match content.
- Jobs and Employer Spotlight use existing authorized public data. Feed,
  career-path, growth, and event content is curated, bilingual, and display-only.
- Candidate shortcuts are My Dashboard, My Applications, and Saved Jobs.
  Employer shortcuts are My Dashboard and the existing recruiter-status-resolved
  Post a Job action. Orders is excluded.
- Home supports Vietnamese and English. Every Home-authored string is included
  in the language switch; underlying job and company records are not translated
  by this feature.
- The final hero search contains keyword, location, work arrangement,
  employment type, experience level, and skills. No other search field is part
  of Home MVP.
- Career Community, Companies, and Events navigation use matching Home anchors.
  Curated cards and Employer Spotlight cards remain display-only because this
  feature has no confirmed existing public detail route for them.

## Delivery Status and Release Gate

- This feature is **In Progress**, not release-ready.
- A task is complete only after its own acceptance criteria and required
  automated or manual evidence are complete. The presence of partial code or a
  placeholder test does not make a task complete.
- Release readiness requires recorded evidence for type validation, focused
  Home lint, unit, component, integration, security/privacy, accessibility,
  responsive keyboard-flow, and end-to-end coverage, plus the specified
  performance and moderated usability evidence.
- `release-validation.md` is the evidence ledger. An unexecuted check must stay
  explicitly open and must not be represented by a related but narrower check.
- The feature must not be marked release-ready while any required P1 behavior,
  privacy check, accessibility check, performance outcome, or manual usability
  outcome lacks evidence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand and Search Smart Hire (Priority: P1)

A guest or job seeker opens the shared Home page, understands Smart Hire within
seconds, and starts an existing job-discovery journey using the final set of
Home search controls.

**Why this priority**: Understanding the product and reaching relevant jobs are
the primary candidate outcomes of Home.

**Independent Test**: A first-time visitor identifies the product purpose,
enters any combination of the six supported search criteria, switches language
without losing the criteria, and reaches job discovery with only those criteria.

**Acceptance Scenarios**:

1. **Given** a visitor opens Home, **When** the hero becomes usable, **Then** it
   communicates “Find the right job. Meet the right team. Grow in the right
   direction.” and shows job-seeker and employer next steps.
2. **Given** a visitor enters keyword, location, work arrangement, employment
   type, experience level, or skills, **When** they submit, **Then** only the
   populated supported criteria are handed to existing job discovery.
3. **Given** entered criteria, **When** the visitor changes Home language,
   **Then** every entered value and selection remains unchanged.
4. **Given** an attempted unknown, session, role, score, or curated-content
   parameter, **When** Home prepares the job-discovery handoff, **Then** that
   parameter is rejected and not forwarded.
5. **Given** no matching jobs, **When** results are shown, **Then** the visitor
   can adjust the existing criteria and continue using Home.

---

### User Story 2 - Use One Session-Aware Home (Priority: P1)

Guests, authenticated candidates, eligible employers, and visitors whose
session has expired use the same Home structure. Only private account controls,
role-authorized shortcuts, employer action state, save state, and valid personal
matching vary.

**Why this priority**: A single predictable Home avoids conflicting experiences
and prevents stale private presentation.

**Independent Test**: Open the same route in guest, candidate, employer, and
expired-session states and compare the ordered sections, account presentation,
shortcuts, employer action, and private output.

**Acceptance Scenarios**:

1. **Given** no valid session, **When** Home loads, **Then** Log in and Sign up
   are shown and no name, avatar, shortcut, saved state, personal score,
   membership, or private identifier is exposed.
2. **Given** a valid candidate session, **When** Home loads, **Then** the user's
   display name, avatar or fallback, Log out, My Dashboard, My Applications, and
   Saved Jobs are available without changing the shared section order.
3. **Given** a valid eligible employer session, **When** Home loads, **Then** My
   Dashboard and the existing recruiter-status-resolved Post a Job action are
   available; candidate-specific personal Smart Match information is not shown.
4. **Given** recruiter status is pending, rejected, or unavailable, **When** the
   employer action is rendered, **Then** Home uses the existing eligibility
   state or destination and never guesses a company, grant, or posting URL.
5. **Given** a session expires, **When** Home next resolves session-dependent
   presentation or an account-required action, **Then** private presentation is
   removed and the page returns to guest behavior without a stale private flash.
6. **Given** logout fails, **When** the request completes, **Then** localized,
   recoverable feedback is announced and duplicate logout activation was
   prevented while the first action was pending.

---

### User Story 3 - Evaluate Jobs and Smart Match (Priority: P1)

An authenticated candidate with sufficient existing profile signals can see a
genuine existing deterministic/profile-backed Smart Match job-fit
recommendation for their own job discovery. It does not score candidates for
employers and is not applicant screening. Everyone else sees an explicitly
illustrative example that cannot be mistaken for personal evaluation.

**Why this priority**: Matching is a central value proposition and must be
truthful, explainable, and privacy-safe.

**Independent Test**: Compare a sufficient-profile candidate, an
insufficient-profile candidate, a guest, and an employer; verify the source
label, explanation, job-card scores, and absence of candidate-specific output.

**Acceptance Scenarios**:

1. **Given** an authenticated candidate has sufficient existing profile data
   and an existing valid job-fit recommendation, **When** Home loads, **Then**
   Smart Match displays that genuine recommendation with score, matching skills,
   improvement areas, limitations, and estimate/recommendation wording.
2. **Given** a guest, employer, or candidate without a usable personal result,
   **When** Home loads, **Then** Smart Match is clearly labelled illustrative
   and contains no inferred or leaked candidate-specific information.
3. **Given** no valid personal match score for the current candidate and job,
   **When** Trending Opportunities renders, **Then** no match score is shown on
   that job card.
4. **Given** a valid personal match score for the current candidate and job,
   **When** the job card renders, **Then** the compact score is labelled as a
   match estimate, remains consistent with the existing job-fit recommendation,
   and gives the candidate a clear path to the detailed Smart Match explanation
   without repeating all detailed fields on the card.
5. **Given** any Smart Match recommendation or illustrative example, **When** it
   is presented, **Then** wording never treats it as a hiring decision,
   applicant-screening result, or objective truth.
6. **Given** save succeeds or fails, **When** an authenticated candidate saves
   a job, **Then** success is announced; on failure the prior state is restored
   and localized recovery feedback is announced.

---

### User Story 4 - Explore Verified Employers and Career Content (Priority: P1)

A visitor can understand employer and career-community value without Home
inventing company claims or presenting unavailable workflows as interactive.

**Why this priority**: Employer credibility is essential to trust, while
display-only career content keeps the MVP honest and bounded.

**Independent Test**: Inspect every Employer Spotlight and curated card and
verify its source, optional fields, labels, and destination behavior.

**Acceptance Scenarios**:

1. **Given** authorized public company information is available, **When** an
   Employer Spotlight card is shown, **Then** it contains only an explicit safe
   public projection and any culture, workplace badge, or open-position count
   is present only when verified by its authoritative source.
2. **Given** culture, badge, or authoritative open-position count is unavailable,
   **When** a card is prepared, **Then** the field is omitted; it is not inferred
   from Trending Opportunities or replaced with fabricated copy.
3. **Given** no valid spotlight projection is available, **When** the section
   renders, **Then** it shows a localized section-level empty or error state and
   other Home sections remain usable.
4. **Given** no confirmed public company detail route exists in current scope,
   **When** a spotlight card renders, **Then** it is labelled display-only and
   is not presented as a link.
5. **Given** a feed, career path, growth resource, or event card, **When** it
   renders, **Then** it is visibly display-only and does not simulate article,
   social, registration, or content-management behavior.

---

### User Story 5 - Navigate a Localized, Resilient Home (Priority: P1)

A visitor can use all essential Home content and actions in Vietnamese or
English on desktop, tablet, or mobile, including when jobs, company data, or a
session-dependent action is unavailable.

**Why this priority**: Missing localization, inaccessible controls, or a failed
optional section makes the shared Home unreliable for core users.

**Independent Test**: At desktop, tablet, and mobile widths, use keyboard-only
navigation in both languages and exercise loading, empty, error, retry, guest,
candidate, employer, and expired-session states.

**Acceptance Scenarios**:

1. **Given** either supported language, **When** any Home-authored visible or
   assistive string appears, **Then** it uses the selected language, including
   labels, placeholders, accessible names, statuses, retries, account-required
   messages, logout feedback, menu labels, and match labels.
2. **Given** a jobs or company section is loading, empty, or failed, **When** it
   renders, **Then** it shows a localized, non-technical state while header,
   hero, search, logout, and unrelated sections remain usable.
3. **Given** recovery reloads the entire Home rather than one section, **When**
   recovery is offered, **Then** its label explicitly says Home will reload and
   does not imply a section-only retry.
4. **Given** desktop, tablet, or mobile layout, **When** primary journeys are
   completed, **Then** controls do not overlap or become cramped and the page
   does not scroll horizontally.
5. **Given** keyboard, screen reader, zoom, or reduced-motion use, **When** Home
   is navigated, **Then** focus is visible, heading order is meaningful, menu
   focus is contained and restored, text alternatives are available, and no
   essential behavior depends on hover, color, motion, or pointer precision.

### Edge Cases

- Missing, invalid, or inaccessible avatar: show a localized, non-identifying
  fallback with a meaningful account label.
- Empty or unusually long display name: use a neutral localized account label
  and preserve account/menu alignment without exposing email as a fallback.
- Sufficient profile but unavailable existing match computation: use
  illustrative Smart Match and remove all job-card match scores.
- Employer who also has a base candidate identity: employer Home presentation
  still receives illustrative content unless the current authorized experience
  is explicitly the candidate context; no candidate-specific match is exposed
  in employer presentation.
- Company public identity exists but optional brand claims are unverified: show
  identity only, omit claims and counts, and keep the card display-only.
- Jobs succeed while company projection fails, or the reverse: each section
  resolves independently and does not borrow or infer the other section's data.
- Unknown or duplicate search parameters: unsupported keys are removed and
  supported multi-select values are validated and de-duplicated before handoff.
- Removed curated content or missing destination: omit the unavailable item or
  show it as display-only; never create a broken link.
- Long job titles, company names, locations, skills, localized labels, or status
  messages wrap without covering actions or causing horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

#### Shared page and session behavior

- **FR-001**: Smart Hire MUST provide one shared Home route and one ordered core
  section structure for guests, candidates, and employers.
- **FR-002**: The header MUST provide the Smart Hire identity, Explore Jobs,
  Career Community, Companies, Events, language selection, and session-aware
  account actions.
- **FR-003**: Guests MUST receive Log in and Sign up and MUST NOT receive private
  identity, shortcuts, saved state, membership, or personal matching data.
- **FR-004**: Authenticated presentation MUST provide display name, avatar or
  fallback, and Log out without using email as a public fallback.
- **FR-005**: Candidates MUST receive only My Dashboard, My Applications, and
  Saved Jobs. Employers MUST receive My Dashboard and the authorized Post a Job
  state. Orders MUST be absent.
- **FR-006**: Expired or invalid sessions MUST resolve to guest presentation and
  MUST remove stale private identity, shortcut, match, save, and membership data.

#### Hero search and quick filters

- **FR-007**: The hero MUST display the exact English message “Find the right
  job. Meet the right team. Grow in the right direction.” and an equivalent
  approved Vietnamese translation.
- **FR-008**: The final Home search MUST support exactly keyword, location, work
  arrangement, employment type, experience level, and skills.
- **FR-009**: Search values MUST use only values already accepted by existing job
  discovery and MUST be validated before handoff.
- **FR-010**: Home MUST reject unknown search parameters and MUST NOT forward
  language, session, role, membership, score, or curated-content information.
- **FR-011**: Switching Home language MUST preserve keyword and every selected
  filter exactly.
- **FR-012**: A no-result handoff MUST remain recoverable through the existing
  job-discovery controls and MUST NOT make Home unavailable.

#### Navigation and destinations

- **FR-013**: Explore Jobs MUST go to `/jobs`; Career Community MUST go to
  `#community`; Companies MUST go to `#employer-spotlight`; Events MUST go to
  `#events`.
- **FR-014**: Job cards MUST use the existing `/jobs/[slug]` destination.
- **FR-015**: Guest Create Profile MUST use existing registration or a safe
  authentication return to `/profile`; authenticated Create Profile MUST go to
  `/profile`.
- **FR-016**: Candidate shortcuts MUST use `/dashboard`, `/jobs/applied`, and
  `/jobs/saved`.
- **FR-017**: Post a Job MUST use only the existing recruiter-status-resolved
  state and destination; Home MUST NOT construct a recruiter or company URL.
- **FR-018**: Feed, career-path, growth-resource, event, and Employer Spotlight
  cards MUST be labelled display-only and MUST NOT be interactive while no
  confirmed existing public detail destination is in scope.
- **FR-019**: Footer links MUST use only valid existing routes or the matching
  Home anchors defined above.

#### Smart Match and job-card scores

- **FR-020**: An authenticated candidate with sufficient existing profile data
  MUST receive a genuine candidate-facing job-fit recommendation from the
  existing deterministic/profile-backed matching capability when that
  recommendation is available. This recommendation MUST rank jobs for the
  candidate's own discovery experience and MUST NOT be presented or supplied as
  employer-facing applicant screening.
- **FR-021**: Guests, employers, and candidates with insufficient or unavailable
  profile data or match output MUST receive clearly labelled illustrative Smart
  Match content.
- **FR-022**: Home MUST NOT create a separate scoring engine, change matching
  rules, or persist new matching data.
- **FR-023**: Every detailed Smart Match insight that displays a score MUST
  include matching skills, improvement areas, limitations, and wording that it
  is an estimate or recommendation, not a hiring decision or
  applicant-screening result.
- **FR-024**: A compact job-card match estimate MUST appear only for the current
  authenticated candidate when a valid personal recommendation exists for that
  job. When displayed, it MUST be labelled as an estimate and clearly associated
  with the detailed Smart Match explanation; the card is not required to repeat
  the detailed matching skills, improvement areas, or limitations.
- **FR-025**: Illustrative Smart Match scores MUST NOT be copied onto job cards.
- **FR-026**: Employer presentation MUST NOT receive candidate-specific personal
  Smart Match data, profile signals, matching skills, gaps, or job-card scores.

#### Employer Spotlight public projection

- **FR-027**: Employer Spotlight MUST use an explicit, safe public company
  projection from existing authorized data and MUST load independently of
  Trending Opportunities.
- **FR-028**: The public projection MUST contain only publishable company
  identity and optional fields whose public source is authoritative.
- **FR-029**: Culture, Hybrid, Mentoring, Internship-friendly, and open-position
  claims MUST NOT be inferred from the six Trending Opportunities cards.
- **FR-030**: An optional culture statement, badge, or open-position count MUST
  be shown only when verified public data supplies that exact claim; otherwise
  the field MUST be omitted.
- **FR-031**: Home MUST NOT fabricate company descriptions, work arrangements,
  mentoring programs, internship suitability, or counts.
- **FR-032**: A spotlight card MUST be display-only until a valid existing public
  company destination is confirmed; an unavailable projection MUST produce a
  localized local empty or error state.

#### Required Home content

- **FR-033**: Home MUST contain no more than three What's New Today cards and,
  when all types are present, exactly one career post, one company hiring post,
  and one career-guidance item.
- **FR-034**: Career Paths MUST contain Software Engineering, UI/UX Design, Data
  & AI, Digital Marketing, Business & Sales, and Product Management.
- **FR-035**: Trending Opportunities MUST contain no more than six authorized
  public jobs with title, company, location, work arrangement, up to five
  skills, detail destination, optional valid personal score, and save action.
- **FR-036**: Career Growth Hub MUST cover CV, interview, portfolio, and skills
  roadmap content.
- **FR-037**: Career Events MUST cover workshop, portfolio review, career day,
  and HR Q&A examples without offering registration.
- **FR-038**: Home MUST provide distinct final calls to action for job seekers
  and employers followed by a footer.
- **FR-039**: Curated content MUST be plausible in a Vietnamese recruitment
  context, clearly display-only, and MUST NOT claim to be live or endorsed.

#### Localization

- **FR-040**: Vietnamese and English MUST cover every Home-authored visible
  label, placeholder, accessible name, status message, loading message, empty
  message, error message, recovery label, account-required message, logout
  message, mobile-menu label, and match-score label.
- **FR-041**: All Home-authored strings MUST come from one centralized Home
  localization source; Home components MUST NOT introduce hard-coded visible or
  assistive Vietnamese or English strings.
- **FR-042**: Underlying job and company record content is outside Home
  translation scope and MUST remain unchanged.
- **FR-043**: Language switching MUST NOT alter session state, authorization,
  recruiter status, Smart Match source, job/company records, or search values.

#### Loading, empty, error, recovery, and privacy

- **FR-044**: Each dynamic Home section MUST provide localized loading, empty,
  and non-technical error states while preserving useful page geometry.
- **FR-045**: Recovery MUST be scoped to the failed source where supported. If
  recovery reloads all of Home, the label MUST explicitly say “Reload Home” in
  the selected language and MUST NOT imply a section-only retry.
- **FR-046**: Failure in jobs or company data MUST NOT break header, hero,
  search, logout, or unrelated content.
- **FR-047**: Guest account-required actions MUST provide localized explanation
  and a safe existing authentication destination without leaking protected data.
- **FR-048**: Save and logout actions MUST prevent duplicate activation while
  pending, announce success where applicable, and provide localized recoverable
  failure feedback.
- **FR-049**: Home MUST expose only public or current-session-authorized data and
  MUST NOT expose private profile email, profile signals, applications,
  membership details, credentials, tokens, private identifiers, or raw errors.

#### Visual consistency and accessibility

- **FR-050**: Home MUST use one consistent Smart Hire typography system across
  header, hero, cards, controls, labels, statuses, and footer.
- **FR-051**: Section spacing, card padding, grid gaps, button dimensions, line
  heights, radii, shadows, and hierarchy MUST follow one coherent visual rhythm.
- **FR-052**: Header, hero search, account controls, shortcuts, job cards,
  spotlight cards, Smart Match, final calls to action, and footer MUST align
  without cramped or overlapping controls.
- **FR-053**: Desktop, tablet, and mobile layouts MUST not cause horizontal page
  scrolling at supported widths or 200% zoom.
- **FR-054**: Home MUST preserve semantic landmarks and heading order,
  descriptive text alternatives, keyboard operation, visible focus, adequate
  contrast, and reduced-motion behavior.
- **FR-055**: Color, motion, hover, and pointer precision MUST NOT be the only
  means of understanding or using any state or primary action.

#### Verification and release readiness

- **FR-056**: Required automated evidence MUST cover focused unit, component,
  integration, security/privacy, accessibility, responsive keyboard-flow, and
  end-to-end behavior for all P1 requirements.
- **FR-057**: Session evidence MUST cover guest, candidate, employer, and
  expired-session states and prove no private guest or stale-session output.
- **FR-058**: Focused evidence MUST cover personal versus illustrative Smart
  Match, safe public company projection, query handoff, language preservation,
  anchors and destinations, recovery semantics, save success/failure, logout
  feedback, and avatar fallback.
- **FR-059**: Required validation runs MUST include type validation, focused Home
  tests, focused Home lint, and applicable end-to-end and accessibility checks.
- **FR-060**: Manual release evidence MUST include the defined responsive,
  performance, and moderated first-visit usability outcomes.
- **FR-061**: Only actually executed evidence may be recorded as passed; every
  unexecuted, failed, or blocked check MUST remain explicitly open.

### Key Entities

- **Home session context**: Safe guest, candidate, or employer presentation from
  the current valid session, containing only display identity and authorized
  actions required by Home.
- **Home search criteria**: Keyword, location, work arrangement, employment
  type, experience level, and skills; no additional Home parameter is allowed.
- **Job opportunity summary**: Authorized public job preview with an optional
  current-candidate personal match estimate.
- **Smart Match insight**: Either a genuine existing profile-backed,
  candidate-facing job-fit recommendation for the current candidate's own job
  discovery or a clearly labelled illustrative example, with explicit source
  kind, explanation, strengths, gaps, and limitations. It is not an
  employer-facing applicant-screening result.
- **Public Employer Spotlight projection**: Publishable company identity plus
  individually optional, source-verified culture, badge, and authoritative
  open-position fields; it has an explicit display-only destination state.
- **Curated Home item**: Bilingual, display-only feed, career-path, growth, or
  event content with no engagement or registration state.
- **Home section state**: Localized loading, ready, empty, or error presentation
  with scoped recovery or an explicitly labelled full Home reload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In moderated first-visit testing with at least 10 target job
  seekers, at least 90% correctly describe Smart Hire's purpose within 5 seconds.
- **SC-002**: At least 90% of the same job-seeker cohort start a keyword-and-filter
  search and reach job discovery within 30 seconds on the first attempt.
- **SC-003**: In moderated testing with at least 10 eligible employers, at least
  90% identify and start the authorized Post a Job path within 30 seconds on the
  first attempt.
- **SC-004**: Across at least 100 samples, 10 concurrent visitors, and at least
  1,000 active public jobs, the usable primary header and hero appear within 3
  seconds at P95 on desktop 1366×768 and mobile 390×844, with under 1% error rate.
- **SC-005**: Under the same conditions, search handoff and results availability
  complete within 2 seconds at P95.
- **SC-006**: 100% of tested guest, candidate, employer, and expired-session cases
  show the correct controls and expose no unauthorized private data.
- **SC-007**: 100% of tested sufficient-profile candidates receive the genuine
  available personal match, while 100% of guest, employer, insufficient-profile,
  and unavailable-result cases receive illustrative content with no personal
  job-card score.
- **SC-008**: 100% of Employer Spotlight fields in the verification sample are
  traceable to approved public data; zero culture, badge, or count claims are
  inferred or fabricated.
- **SC-009**: All supported search values survive a language switch, and 100% of
  unknown or prohibited handoff parameters are rejected.
- **SC-010**: All Home navigation and action targets in both languages resolve
  to a valid existing route, matching anchor, or explicitly display-only item;
  zero broken or misleading interactive cards remain.
- **SC-011**: At desktop, tablet, mobile, and 200% zoom, all primary tasks
  complete without overlap or horizontal page scrolling.
- **SC-012**: Keyboard-only users complete all primary actions and recovery
  paths with visible focus; the approved accessibility scan reports zero serious
  or critical violations.
- **SC-013**: Every tested loading, empty, and failed dynamic-section state keeps
  header, hero, search, logout, and unrelated sections usable.
- **SC-014**: Release status remains In Progress until every required automated,
  performance, and moderated usability result is recorded as passed.

## Assumptions

- Home remains the existing public `/` route; legacy `/home` continues its
  existing redirect behavior.
- Existing authentication, profile, job discovery, saved jobs, recruiter
  eligibility, and posting workflows remain the authority for their behavior.
- Existing matching determines profile sufficiency and the genuine personal
  result. Home neither changes the formula nor stores new matching data.
- Existing authorized public company data can supply a safe projection. If it
  cannot supply a field or a complete card, Home omits that field or shows the
  local empty/error state.
- No confirmed public detail route currently exists for Employer Spotlight or
  curated Home cards, so those cards are display-only in this feature.
- Curated examples are controlled presentation content, not live posts, events,
  endorsements, or registrable activities.
- Translating job and company record content is owned outside Home.

## Scope Boundaries

**Included**: The existing shared Home route, session-aware presentation,
authorized existing workflow links, final six-field job-search entry, genuine
candidate-facing job-fit recommendation or illustrative Smart Match
presentation, safe public Employer Spotlight projection, curated display-only
content, centralized bilingual Home copy, dynamic states, responsive visual
consistency, accessibility, privacy, and required release evidence.

**Excluded**: New APIs or service endpoints, database tables or migrations,
matching or recommendation engines, matching persistence, CMS or content
authoring, likes/comments/shares, event registration, public company detail
pages, authentication changes, recruiter administration, job-post creation
implementation, application workflow changes, payments/orders, chat, AI CV
parsing, video interviews, or a complete recruitment-management system.
