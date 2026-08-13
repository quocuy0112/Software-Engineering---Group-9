# Home Requirements Review Checklist: Smart Hire Home/Landing Page

**Purpose**: Assess whether the Home-page requirements are complete, clear, consistent, measurable, and bounded before implementation or PR review.
**Created**: 2026-08-12
**Feature**: [spec.md](../spec.md)
**Planning context**: [plan.md](../plan.md)

## Value Proposition and Journey Definition

- [x] CHK001 Are the first-five-seconds value proposition, audience, and exact hero message all specified without relying on visual interpretation alone? [Completeness, Spec §US1/FR-006, SC-001]
- [x] CHK002 Is the relation between job discovery, employer reach, Smart Match, and career-community value clear enough to prevent competing primary messages? [Clarity, Spec §US1–US4]
- [x] CHK003 Are job-seeker primary actions, employer primary actions, and their intended next steps defined for both guest and authenticated states? [Completeness, Spec §FR-007–FR-010]
- [x] CHK004 Are the job-seeker and employer journeys consistent with the existing-destination-only scope boundary? [Consistency, Spec §FR-009–FR-010, FR-033]
- [x] CHK005 Can the stated 5-second comprehension, 30-second job-search, and 30-second employer-path outcomes be measured with a defined participant group and completion definition? [Measurability, Spec §SC-001–SC-003]

## Shared Session-Aware Home

- [x] CHK006 Is one shared Home route/layout explicitly required, with a complete list of the account-dependent areas allowed to vary? [Completeness, Spec §FR-001–FR-005; Plan §Shared page composition]
- [x] CHK007 Are guest, authenticated Candidate, and eligible Employer account states distinguished without implying that a role may be inferred only from client presentation? [Clarity, Spec §US2; Plan §Session-aware presentation matrix]
- [x] CHK008 Are Login, Sign up, avatar/display-name fallback, account menu, Log out, session-expiry, and unavailable-personal-data requirements mutually consistent? [Consistency, Spec §US2, Edge Cases, FR-003–FR-005, FR-024]
- [x] CHK009 Are Candidate shortcuts limited and named consistently as My Dashboard, My Applications, and Saved Jobs, while Employer shortcuts are limited to My Dashboard and Post a Job? [Consistency, Spec §Clarifications, FR-023]
- [x] CHK010 Is the explicit exclusion of Orders consistent across shortcuts, final calls to action, scope boundaries, and future enhancements? [Consistency, Spec §Clarifications, FR-023, Scope Boundaries; Plan §MVP vs Future Enhancements]
- [x] CHK011 Are the exact destinations and authorized handoff constraints specified for Create Profile, Dashboard, Applications, Saved Jobs, and Post a Job? [Completeness, Spec §Clarifications, FR-009–FR-010, FR-023]

## Content, Data, and Smart Match Consistency

- [x] CHK012 Are the required sections and their content limits explicit, including the maximum three What's New Today items and six named Career Paths? [Completeness, Spec §FR-011, FR-014–FR-021]
- [x] CHK013 Are job-feed, employer-spotlight, Smart Match, career-content, and event requirements coherent in their purpose, public-data boundaries, and relationship to the Home goals? [Consistency, Spec §US3–US4, FR-011–FR-022]
- [x] CHK014 Is the distinction between Jobs/Companies sourced from existing backend data and feed/growth/event content sourced from controlled display-only mock data unambiguous? [Clarity, Spec §Clarifications, FR-034–FR-035]
- [x] CHK015 Are the requirements explicit that social-feed items have no likes, comments, persistence, registration, or other implied engagement workflow in MVP? [Completeness, Spec §FR-035, Assumptions]
- [x] CHK016 Are Vietnamese recruitment-context examples constrained to be plausible and non-endorsing, with enough guidance to avoid fabricated claims about employers, jobs, events, scores, or career outcomes? [Clarity, Spec §FR-022, Assumptions]
- [x] CHK017 Are public versus private fields unambiguously separated for job cards, company cards, account context, personal match data, and error feedback? [Coverage, Spec §FR-005, FR-032; Plan §Display data]
- [x] CHK018 Are Smart Match personal-data eligibility, illustrative fallback, explanation, improvement areas, and recommendation-not-decision wording consistent with the project constitution? [Consistency, Spec §FR-012–FR-013, Assumptions; Plan §Constitution Check]

## Responsive, Localization, and Accessibility Requirements

- [x] CHK019 Are desktop, tablet, and mobile layout requirements sufficiently specific about navigation access, content flow, card density, search controls, and no-horizontal-scroll expectations? [Completeness, Spec §US5, FR-029, SC-007]
- [x] CHK020 Are compact-navigation requirements defined with keyboard, expanded/collapsed, focus-management, and restoration expectations rather than only visual responsiveness? [Coverage, Spec §FR-030–FR-031; Plan §Accessibility]
- [x] CHK021 Are Vietnamese and English requirements complete for Home-authored labels, calls to action, loading/empty/error/authentication feedback, and curated mock content? [Completeness, Spec §FR-036]
- [x] CHK022 Is the language-switcher requirement explicit that it preserves session state and submitted search criteria while not changing authorization, eligibility, or match outcomes? [Clarity, Spec §FR-037]
- [x] CHK023 Are non-color communication, text alternatives, avatar fallback, keyboard access, visible focus, reduced-motion behavior, and announcement requirements consistently applied to every Home-specific interactive/stateful element? [Consistency, Spec §FR-016, FR-030–FR-031, Edge Cases]
- [x] CHK024 Can the accessibility outcome be objectively assessed through the stated keyboard completion scope and zero serious/critical scan threshold? [Measurability, Spec §SC-008]

## Resilience, State, and Performance Requirements

- [x] CHK025 Are loading, empty, error, and retry requirements defined for each dynamic Home section rather than only for the page as a whole? [Completeness, Spec §FR-025–FR-027; Plan §Responsive and system states]
- [x] CHK026 Are unauthenticated-action and expired-session requirements complete for save, profile, shortcuts, and employer actions without exposing protected context or losing a safe intended destination? [Coverage, Spec §US1–US3, Edge Cases, FR-018, FR-028]
- [x] CHK027 Are missing avatar, unavailable profile/match data, removed content, long card text, and delayed matching requirements sufficiently explicit to avoid conflicting fallback behavior? [Edge Case Coverage, Spec §Edge Cases]
- [x] CHK028 Are page-load and search performance criteria quantified with P95, representative conditions, error-rate boundaries, and non-blocking optional content expectations? [Measurability, Spec §SC-004–SC-005; Plan §Technical Context]
- [x] CHK029 Are section-level failure boundaries clear enough to prevent Jobs/Companies source failures from being interpreted as a global Home, authentication, or logout failure? [Clarity, Spec §FR-027, SC-009; Plan §Shared page composition]

## MVP Scope and Dependency Boundaries

- [x] CHK030 Are existing authentication, jobs, profile, saved-job, recruiter eligibility, community, company, and event destinations explicitly identified as dependencies that retain ownership of their workflows? [Dependency, Spec §FR-033, Assumptions]
- [x] CHK031 Are deferred capabilities explicitly bounded so that real-time chat, a full social network, social interactions, CMS, event registration, AI CV parsing, video interviews, job-post workspace, recruitment management, and payment/orders cannot enter through Home requirements? [Scope Boundary, Spec §Scope Boundaries; Plan §MVP vs Future Enhancements]
- [x] CHK032 Are requirements clear that Home does not create a recommendation service, job-search ranking rule, employer verification rule, membership decision, or separate authentication mechanism? [Scope Boundary, Spec §FR-033, Assumptions; Plan §Constitution Check]

## Notes

- This is a requirements-review checklist, not an implementation test plan.
- Resolve unchecked items by improving `spec.md` or `plan.md`; record a decision rather than inferring new scope during implementation.
- Review completed on 2026-08-12: all checklist items are satisfied after defining the moderated-study participant cohorts and representative P95 measurement conditions.
- Amendment review also confirmed: genuine Candidate-only personal Smart Match;
  illustrative guest/employer/insufficient states; independent source-verified
  public company projection; all six approved search controls; valid
  route/anchor/display-only destinations; centralized complete Home localization;
  honest scoped or Reload Home recovery; visual-system consistency; and an
  evidence-based In Progress release gate.
- Checked items confirm requirement quality only. They do not indicate that the
  corresponding implementation tasks or release evidence have passed.
