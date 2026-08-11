# Feature Specification: Recruiter Base Role - Group 1 Header Layout Change

**Feature Branch**: `007-job-posting-management`  
**Created**: 2026-08-11  
**Status**: Draft  
**Input**: Refine the existing recruiter-header specification so its read-only status behavior is traceable and testable, then resolve post-task analysis findings by applying the exact-host boundary to every disclosure path, bounding the permitted high-level opening behavior, and defining reproducible performance and usability protocols.

## Clarifications

### Session 2026-08-11

- Q: Does the exact Candidate-host boundary apply only to later status refreshes? → A: No. It applies before both the initial workspace projection and every later refresh; another or malformed host receives only a neutral unavailable result before session detail or recruiter status is read or disclosed.
- Q: What opening behavior belongs to Group 1? → A: Group 1 may request exactly one opening of the already approved high-level destination and observe whether the initiating view remains available so a failed or cancelled attempt can be retried. It may not select a recruiter company or workspace, choose another destination, implement destination content or progress, change authorization, or animate a transition.
- Q: What conditions make the latency outcomes reproducible? → A: Use the fixed validation protocol in this specification. Page-load timing starts when authenticated workspace navigation starts and ends on the first rendered frame where theme and profile controls are operable and the recruiter-action footprint is visible as either a confirmed action or safe placeholder. The 200 refresh samples use a defined trigger-by-result-state matrix, and refresh timing continues through the visible label and availability update.
- Q: How is the five-second status-identification outcome validated? → A: Use exactly 20 uncoached participants who used an online job-search or application service during the previous 12 months, can use the product language under test, did not implement or review this feature, and have not seen the study materials. Assign exactly five to each confirmed state and include 10 primarily mobile and 10 primarily desktop/laptop job seekers; count success only when both status and action availability are identified correctly within five seconds.

- Q: What should the recruiter-status action do while an application is pending review? → A: Display `Application Under Review` as a disabled control that opens no destination; the application flow for a Candidate who has never applied belongs to a future specification.
- Q: How should the header actions be arranged on mobile, and may the recruiter-status label wrap? → A: Keep `[dark/light toggle] [user profile] [recruiter-status action]` on one row; the rightmost action pushes theme/profile left, and its complete label stays on one line without wrapping.
- Q: What should appear while recruiter-verification status is loading or temporarily unavailable? → A: Reserve the action's space and show a disabled loading placeholder until a confirmed status is available.
- Q: What profile content should remain visible in the mobile header action row? → A: Show the avatar, display name, and email.
- Q: Should the pending-review control remain keyboard-focusable? → A: Keep it in the Tab order, announce it as disabled, and allow no activation.

## User Scenarios & Testing

### User Story 1 - Candidate who has never applied (Priority: P1)

As a Candidate who has never applied for recruiter verification, I want to see a `Post a Job` action in the top-right of my header, so that I can discover and begin the recruiter-application path.

**Expected behavior**: The button is enabled. Activating it opens the recruiter-application entry point at a high level; the destination's content and workflow are outside Group 1.

**Why this priority**: Candidates without an application need a discoverable entry point into the employer-verification journey.

**Independent Test**: Use an authenticated Candidate with no current recruiter entitlement and no qualifying application history; verify the exact action label and one successful opening through each supported activation method.

**Acceptance Scenarios**:

1. **Given** an authenticated Candidate with no current recruiter entitlement and a never-applied-equivalent history, **When** the workspace header is shown, **Then** an enabled `Post a Job` action appears at the rightmost position.
2. **Given** that enabled action, **When** the Candidate activates it by mouse, touch, Enter, or Space, **Then** the existing recruiter-application entry point opens exactly once.

### User Story 2 - Applicant awaiting review (Priority: P1)

As a Candidate whose recruiter application is pending review, I want the header to show `Application Under Review`, so that I can understand my current status without attempting to submit another application.

**Expected behavior**: The control is visibly and semantically disabled. Activating it by pointer, keyboard, or touch performs no action and opens no destination.

**Why this priority**: A pending applicant must understand that review is ongoing and must not be encouraged to create a duplicate application.

**Independent Test**: Use each qualifying in-review state; verify the exact label remains keyboard-focusable, is announced as unavailable, and never opens a destination.

**Acceptance Scenarios**:

1. **Given** an authenticated Candidate with no current recruiter entitlement and a latest in-review request, **When** the workspace header is shown, **Then** `Application Under Review` appears as a focusable control announced as unavailable.
2. **Given** that pending control, **When** it receives mouse, touch, Enter, or Space activation, **Then** no destination, pressed state, or duplicate request occurs.

### User Story 3 - Rejected applicant (Priority: P1)

As a Candidate whose recruiter application was rejected, I want to see `Reapply as Recruiter`, so that I can find the route for submitting a new recruiter application.

**Expected behavior**: The button is enabled. Activating it opens the recruiter-reapplication entry point at a high level; the destination's content and workflow are outside Group 1.

**Why this priority**: Rejected applicants need an unambiguous path to begin a permitted reapplication.

**Independent Test**: Use an authenticated Candidate whose latest qualifying application is rejected; verify the exact label and one successful opening through each supported activation method.

**Acceptance Scenarios**:

1. **Given** an authenticated Candidate with no current recruiter entitlement and a latest rejected request, **When** the workspace header is shown, **Then** an enabled `Reapply as Recruiter` action appears.
2. **Given** that enabled action, **When** the Candidate activates it by any supported method, **Then** the existing recruiter-reapplication entry point opens exactly once.

### User Story 4 - Approved recruiter (Priority: P1)

As an approved recruiter with current recruiter entitlement, I want to see an active `Post a Job` action, so that I can initiate the move from the Candidate workspace to the Recruiter workspace.

**Expected behavior**: The button is enabled. Activating it requests one opening of the approved high-level recruiter-workspace entry point. Destination selection beyond that entry point, destination content or progress, authorization changes, route construction, company or workspace selection, transition behavior, and animation belong to Group 2 and are not specified here.

**Why this priority**: An entitled recruiter needs a clear entry point from the base Candidate workspace without the header itself granting recruiter authority.

**Independent Test**: Use accounts with active, suspended, removed, inactive-company, multi-company, and stale-approval histories; verify that only a current qualifying entitlement exposes the recruiter-workspace entry point.

**Acceptance Scenarios**:

1. **Given** an authenticated Candidate with an active membership in an active verified company, **When** the workspace header is shown, **Then** an enabled `Post a Job` action exposes the high-level recruiter-workspace entry point regardless of older request history.
2. **Given** only suspended, removed, inactive-company, cross-account, or stale-approved evidence, **When** the workspace header is shown, **Then** the approved state is not exposed.

## 2. Scope

### In scope

- Add one recruiter-status action to the Candidate workspace header.
- Place the action as the rightmost header element.
- Reposition the existing dark/light mode toggle and user profile block immediately to the action's left.
- Preserve this exact right-side sequence: `[dark/light toggle] [user profile] [recruiter-status action]`.
- Select the action label, enabled/disabled treatment, and high-level destination from the user's current recruiter-verification state.
- Determine that state from existing authoritative verification and company-membership records without creating a new persistent recruiter status.
- Refresh the displayed state safely while the Candidate workspace remains visible and usable.
- Limit both the initial status projection and every later refresh to the exact authenticated Candidate workspace host, and expose no underlying account, company, membership, request, evidence, role, or session identifiers.
- Request one opening of the approved high-level destination and release duplicate-activation suppression when an unsuccessful attempt leaves the initiating view available.
- Define default, hover, pressed/active, focus-visible, and disabled presentation for the action.
- Define desktop, tablet, mobile, narrow-viewport, truncation, fallback-avatar, keyboard, and touch behavior for the affected header elements.
- Preserve the existing Candidate workspace search, theme-switching, and profile-navigation behaviors while preventing the new action from overlapping them.

### Out of scope

- The fields, copy, validation, submission, confirmation, or error behavior inside the recruiter application or reapplication modal/page.
- The recruiter-application submission workflow reached by a Candidate who has never applied; it will be defined in a future specification.
- Administrator review, approval, rejection, notifications, and the rules that change verification status.
- Recruiter company or workspace selection, destination choice beyond the approved high-level entry point, destination content, destination loading/progress/error behavior, authorization changes, route construction, transition, or switch animation. These belong to Group 2.
- The job-post creation form and job-post management behavior reached after an approved recruiter enters the Recruiter workspace.
- Changes to the Candidate search experience, sidebar, theme preferences, profile page, or user-profile menu.
- New writable verification data definitions, status transitions, persistent status records, business mutations, audit events, or notification behavior.

## 3. UI states

### Recruiter-status action

The action has a minimum 40 × 40 px interactive area, a visible keyboard focus indicator, readable text in both light and dark themes, and a non-color cue—label and, where used, icon—for every verification state. Its text must use the mappings below exactly in English.

| Verification state | Label | Default | Hover | Pressed/active | Disabled |
|---|---|---|---|---|---|
| Never applied | `Post a Job` | Enabled primary action with solid brand fill, high-contrast text, and a posting/briefcase icon if the header action system uses icons | Stronger brand fill and visible elevation/border change; label remains unchanged | Darker pressed fill with reduced elevation; activation occurs once | Muted fill, border, icon, and text; current label remains visible; no action occurs |
| Pending review | `Application Under Review` | Always presented as a neutral, disabled status treatment with a clock/status icon; it must not resemble an available primary action | No hover elevation, color change, or pointer cursor; keyboard focus still receives a visible focus indicator | No pressed state and no action | Same as default; remains in the Tab order and is announced to assistive technology as unavailable/disabled |
| Rejected | `Reapply as Recruiter` | Enabled secondary action with brand-colored outline/text and a reapply icon if icons are used | Brand-tinted background with stronger outline/text contrast | Stronger tinted fill with reduced elevation; activation occurs once | Neutral muted outline, icon, and text; current label remains visible; no action occurs |
| Approved recruiter | `Post a Job` | Enabled primary action with solid brand fill, high-contrast text, and a posting/briefcase icon if the header action system uses icons | Stronger brand fill and visible elevation/border change; label remains unchanged | Darker pressed fill with reduced elevation; the handoff request occurs once | Muted fill, border, icon, and text while the handoff cannot be initiated or is already in progress; no duplicate action occurs |

For all enabled variants, keyboard focus is visually distinct from hover and remains visible in both themes. A transient disabled/busy state must preserve the current verification label and the action's width so the header does not shift. The pending-review state is disabled by meaning, not merely while processing; it remains keyboard-focusable solely to communicate its status and never activates.

Before a verification state is confirmed, the header reserves the recruiter-status action's final footprint and shows a non-interactive loading placeholder. The placeholder is announced as checking recruiter status, exposes none of the four state labels, and cannot open an application or workspace destination. If status retrieval is temporarily unavailable, the same disabled placeholder remains until a confirmed state is obtained; the header must not guess or elevate the user's state.

### Dark/light toggle after repositioning

- The toggle remains the leftmost item in the right-side action group.
- It retains its current compact icon-only appearance, 40 × 40 px minimum target, theme-appropriate sun/moon icon, border, hover treatment, pressed indication, focus-visible ring, and accessible name describing the theme it will switch to.
- Repositioning must not change the selected theme, theme persistence, or toggle behavior.

### User profile block after repositioning

- The profile block remains immediately right of the theme toggle and immediately left of the recruiter-status action.
- On desktop it retains the avatar, display name, and email/secondary profile text in the existing visual hierarchy.
- On mobile it also shows the avatar, display name, and email. Name and email remain separate single-line values and truncate independently with an ellipsis when space is limited.
- The whole profile block remains one interactive target with its existing hover and focus-visible treatment.
- Missing or invalid avatar imagery uses the existing neutral person/avatar fallback without changing the block's dimensions.

## 4. Layout behavior

### Desktop — viewport width 1024 px and above

- The right-side elements appear on one row in this exact order: `[dark/light toggle] [user profile] [recruiter-status action]`.
- All three elements are vertically centered within the header.
- The gap between adjacent elements is 12 px.
- The recruiter-status action is the last element and sits 24 px from the header's right edge.
- The profile text area may use up to 220 px. Name and email each remain one line and truncate independently with an ellipsis when necessary.
- The action label remains on one line and is never truncated. The center search area yields available width before any right-side action is clipped or overlapped.

### Tablet — viewport width 761–1023 px

- The same order is preserved on one row with 8 px gaps and 16 px right padding.
- The theme toggle remains icon-only.
- The profile shows its avatar and display name; email/secondary text is hidden. The name is limited to 120 px and truncates with an ellipsis.
- The recruiter-status action keeps its full label on one line, including `Application Under Review` and `Reapply as Recruiter`; it does not collapse to an icon.
- If the Candidate header includes search, search moves to or remains on its separate responsive row and must not overlap the right-side group.

### Mobile — viewport width 760 px and below

- The right-side group remains on one horizontal row in this exact order: `[dark/light toggle] [user profile] [recruiter-status action]`.
- The recruiter-status action is anchored at the far right; adding it shifts the theme toggle and profile control left rather than placing the action on another row.
- The row uses a 40 × 40 px icon-only theme toggle, a profile control containing a 48 × 48 px avatar plus a two-line text stack for display name and email, and 8 px gaps. Name and email are each limited to one line and truncate independently with an ellipsis.
- The recruiter-status action preserves its minimum interactive height and sits after the complete profile block. Its complete label stays on exactly one line and must not wrap, truncate, or become icon-only.
- The header uses 16 px side padding.
- Candidate search, when present, occupies its own full-width row below the header identity/actions and must remain usable without horizontal scrolling.

### Very narrow viewports

- At widths where the theme toggle, full profile block, and complete one-line action label cannot fit together, overflow is contained within the header action row and every control remains reachable through horizontal scrolling; the page itself must not scroll horizontally.
- The row must not overlap controls, clip the action label, reduce touch targets, or hide either profile text line merely to avoid contained scrolling.
- Visual order, reading order, and keyboard focus order remain: dark/light toggle, user profile, recruiter-status action.

## 5. Interaction behavior

| Element/state | Pointer, touch, or keyboard activation | Hover/focus behavior |
|---|---|---|
| Theme toggle | Switches between dark and light appearance using existing behavior | Shows its existing hover treatment; focus-visible identifies the control and its accessible name states the destination theme |
| User profile block | Opens the existing Candidate profile destination | Shows its existing hover/focus treatment; truncated name or email is available in full on hover or keyboard focus without changing layout |
| Never-applied action | Opens the recruiter-application entry point | Shows enabled primary hover/focus presentation |
| Pending-review action | Performs no action and opens no destination | Pointer hover remains visually unchanged; keyboard focus displays the standard focus indicator, and assistive technology identifies the control as disabled/unavailable |
| Rejected action | Opens the recruiter-reapplication entry point | Shows enabled secondary hover/focus presentation |
| Approved-recruiter action | Initiates the recruiter-workspace handoff defined by Group 2 | Shows enabled primary hover/focus presentation |

- Tab order must match visual order: theme toggle, profile block, recruiter-status action. The pending control remains keyboard-focusable in that position, is announced as disabled, and cannot be activated.
- Enabled actions respond to `Enter`, `Space`, click, and tap consistently and initiate at most one opening/handoff per activation.
- Once an enabled action has been accepted and its destination is opening, repeat activation is suppressed. If navigation completes, the destination owns subsequent behavior. If opening fails, is cancelled, or leaves the user on the current view, the action becomes available again so the user can retry.
- Group 1 may request one opening of the approved high-level destination and observe whether the initiating view remains available solely to release duplicate-activation suppression. Destination selection beyond that approved entry point, content, close/back behavior, progress, errors, completion, workspace selection, authorization, and transition presentation are outside Group 1.

## 6. Edge cases

- **Long display name**: Remains a single line and truncates with an ellipsis at the breakpoint-specific limit. The full name remains accessible on hover/focus and through the profile control's accessible description.
- **Long email**: Truncates independently on desktop and mobile; it is hidden only on tablet. On mobile it must remain visibly present within the profile block without forcing page-level horizontal scrolling.
- **Missing or invalid avatar**: Uses the fixed-size fallback person/avatar visual. The profile control remains operable and labelled with the user's available name, email, or generic profile label.
- **Longest required action labels**: `Application Under Review` and `Reapply as Recruiter` remain complete and on one line at every breakpoint; they must never wrap, truncate, or become icon-only.
- **Narrow viewport or enlarged text**: The action row preserves one-line labels and minimum interactive sizes. If it cannot fit at up to 200% text zoom, the row itself becomes horizontally scrollable without creating page-level horizontal scrolling.
- **Disabled-state activation**: Click, tap, `Enter`, and `Space` produce no navigation, modal, workspace switch, duplicate request, or pressed animation. The control remains announced as unavailable.
- **Rapid repeated activation**: An enabled action opens or initiates its destination once; it remains transiently disabled until the opening attempt settles.
- **Verification state loading, failure, or change while the header is visible**: The disabled placeholder preserves the action's footprint until a state is confirmed. It exposes no guessed label or action. A newly confirmed state then updates the label and behavior without reordering the theme/profile controls.
- **Light/dark theme change**: All action and focus states continue to meet readable contrast and remain distinguishable without color alone.
- **Search present in the header**: The search field may shrink or move to its defined responsive row, but it must not cover, reorder, or make the right-side controls unreachable.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST show the recruiter-status action throughout the authenticated Candidate workspace.
- **FR-002**: The visual, reading, and keyboard order MUST always be dark/light toggle, user profile, recruiter-status action.
- **FR-003**: The system MUST derive exactly one of four confirmed header states from existing authoritative verification and company-membership information without creating a new persistent recruiter status.
- **FR-004**: A current active membership in an active verified company MUST take precedence over request history and produce the approved-recruiter state.
- **FR-005**: Without current entitlement, a latest request in pending checks, pending review, changes requested, or resubmitted status MUST produce the pending-review state.
- **FR-006**: Without current entitlement, a latest rejected request MUST produce the rejected state.
- **FR-007**: No request, a latest cancelled or expired request, or a stale approval without current entitlement MUST produce the never-applied state.
- **FR-008**: The never-applied state MUST show the exact label `Post a Job` and open the existing recruiter-application entry point.
- **FR-009**: The pending-review state MUST show the exact label `Application Under Review`, remain in the Tab order, be announced as unavailable, and open no destination through any activation method.
- **FR-010**: The rejected state MUST show the exact label `Reapply as Recruiter` and open the existing recruiter-reapplication entry point.
- **FR-011**: The approved state MUST show the exact label `Post a Job` and initiate the high-level recruiter-workspace handoff without granting authority or implementing the downstream workspace-selection experience.
- **FR-012**: Before a state is confirmed, the header MUST reserve the action footprint and show a non-interactive checking-status placeholder with no confirmed-state label or destination.
- **FR-013**: A failed or invalid status read MUST NOT prevent the Candidate workspace from loading or remaining usable, and MUST remove any unconfirmed actionable state until a later confirmation.
- **FR-014**: While the workspace is visible, status refreshes MUST occur no more often than once per 30-second interval, with additional refreshes permitted when the page regains focus or visibility, and no refreshes may overlap.
- **FR-015**: A newly confirmed state MUST update the label and behavior without reordering or shifting the theme and profile controls.
- **FR-016**: Before deriving, reading, or disclosing recruiter status for either the initial workspace projection or any later refresh, the system MUST confirm the exact configured Candidate workspace host; another or malformed host MUST receive only a neutral unavailable outcome before session detail or recruiter status is read or disclosed.
- **FR-017**: The current Candidate session MUST be validated on the server before status information is disclosed.
- **FR-018**: Status information exposed by this feature MUST contain no account, company, membership, verification-request, evidence, role, or session identifiers or submitted business fields.
- **FR-019**: Recruiter status MUST NOT be persisted in browser storage, analytics, or ordinary logs.
- **FR-020**: The header action MUST NOT grant recruiter authority; every destination MUST enforce its own current authorization and business state.
- **FR-021**: Every action MUST have at least a 40 by 40 CSS-pixel interactive area, a visible keyboard focus indicator, readable light/dark presentation, and a non-color status cue.
- **FR-022**: Revalidation and navigation-busy states MUST preserve the current confirmed label and footprint while suppressing activation.
- **FR-023**: After an opening attempt fails, is cancelled, or leaves the user on the current view, the action MUST become available for retry without requiring a page reload.
- **FR-024**: Enabled actions MUST behave consistently for mouse, touch, Enter, and Space and initiate no more than one opening per accepted activation.
- **FR-025**: At 1024 CSS pixels and above, the controls MUST remain on one row with 12-pixel gaps, a 24-pixel right inset, independently truncated name/email values up to 220 pixels, and a complete one-line action label.
- **FR-026**: From 761 through 1023 CSS pixels, the controls MUST use 8-pixel gaps and a 16-pixel right inset; the profile MUST show avatar and name, hide email, limit the name to 120 pixels, and retain the complete one-line action label.
- **FR-027**: At 760 CSS pixels and below, one row MUST contain the 40 by 40 theme toggle, a profile with 48 by 48 avatar plus visible name and email, and the rightmost complete one-line recruiter action with 8-pixel gaps and 16-pixel side padding.
- **FR-028**: When the complete action row cannot fit, only that row MAY scroll horizontally; every control and profile text line MUST remain reachable, and the page and search area MUST NOT scroll horizontally.
- **FR-029**: Truncated profile name and email values MUST remain available in full on pointer hover and keyboard focus, including through the profile control's accessible description, without changing layout or adding another action.
- **FR-030**: The profile control MUST retain its existing Candidate profile destination, whole-target interaction, and fixed-size fallback avatar behavior.
- **FR-031**: Repositioning MUST preserve the theme toggle's existing state, persistence, behavior, accessible name, and presentation.
- **FR-032**: Candidate search MUST remain usable, separate at responsive widths, and free from overlap or reordering caused by the right-side action group.
- **FR-033**: Every required action label MUST remain complete on one line at all supported widths and up to 200 percent text zoom.
- **FR-034**: State determination MUST be scoped to the current account and MUST NOT disclose or authorize data across company memberships.
- **FR-035**: This feature MUST perform no verification decision, state transition, business write, migration, persistent-status creation, notification, or new audit event.
- **FR-036**: This feature MUST NOT implement application or reapplication content, administrator decisions, job-post creation, recruiter company or workspace selection, destination choice beyond the approved high-level entry point, destination content or progress, authorization changes, route construction, transition, or animation.

### Key Entities

- **Recruiter Header Status**: A read-only, non-persistent presentation of one confirmed state, its permitted high-level destination, and when it was observed. It contains no source-record identifiers.
- **Recruiter Verification Request**: Existing authoritative application history. Only the latest relevant lifecycle state is used when no current recruiter entitlement exists.
- **Company Membership**: Existing authoritative relationship that grants recruiter entitlement only when both the membership and its verified company are currently active.
- **Candidate Workspace Session**: The existing authenticated Candidate context used to scope status determination; this feature creates no second session or browser credential.

### Acceptance Criteria

- [ ] A never-applied Candidate sees an enabled `Post a Job` action that opens the recruiter-application entry point.
- [ ] A Candidate with an application pending review sees `Application Under Review` as a visibly and semantically disabled control that remains in the Tab order, receives a visible focus indicator, is announced as disabled, and produces no action through any activation method.
- [ ] A Candidate with a rejected application sees an enabled `Reapply as Recruiter` action that opens the recruiter-reapplication entry point.
- [ ] An approved recruiter sees an enabled `Post a Job` action that initiates the Group 2 recruiter-workspace handoff without implementing the handoff details in Group 1.
- [ ] The right-side visual, reading, and keyboard order is always theme toggle, user profile, recruiter-status action.
- [ ] At widths of 1024 px and above, the three controls remain on one row with 12 px gaps, and the action is 24 px from the right edge.
- [ ] From 761–1023 px, the controls use 8 px gaps and 16 px right padding; profile email is hidden, profile name truncates at 120 px, and every action label remains complete on one line.
- [ ] At 760 px and below, theme, the profile block containing avatar/name/email, and recruiter-status action remain on one row in that order; the rightmost action shifts theme/profile left and never becomes icon-only.
- [ ] Whenever the complete row cannot fit, any necessary overflow is confined to a horizontally scrollable action row; no control overlaps, the action label remains complete, both profile text lines remain visible, and the page never scrolls horizontally.
- [ ] The theme toggle remains 40 × 40 px or larger, keeps its existing theme behavior, and is immediately left of the profile block.
- [ ] The profile block opens the existing Candidate profile destination and uses the existing fallback avatar when no valid avatar is available.
- [ ] Desktop name and email values truncate independently with ellipses; tablet name truncates at 120 px with email hidden; mobile displays avatar, name, and email with both text values independently ellipsized.
- [ ] Default, hover, pressed/active, focus-visible, and disabled presentations match the verification-state matrix in both light and dark themes.
- [ ] While verification status is loading or temporarily unavailable, a disabled placeholder preserves the action's footprint, announces that status is being checked, and exposes no state label or destination until confirmation.
- [ ] All enabled actions work by mouse, touch, `Enter`, and `Space`, while disabled actions initiate nothing.
- [ ] Rapid repeated activation initiates no more than one application, reapplication, or workspace-handoff opening attempt.
- [ ] The longest required labels remain complete on exactly one line at every breakpoint and are never wrapped, truncated, or replaced by an icon.
- [ ] Candidate header search remains usable and never overlaps or reorders the right-side elements at any supported breakpoint.
- [ ] Updating the confirmed verification state updates the action label and enabled behavior without moving the theme toggle or profile block.
- [ ] Group 1 requests only the approved high-level destination opening; no application/reapplication content, job-post form, recruiter company/workspace selection, alternate destination choice, destination content/progress, route construction, authorization change, transition, or switch animation is introduced.
- [ ] Truncated display name and email values are available in full on pointer hover and keyboard focus, and both complete values are included in the profile control's accessible description without layout shift.
- [ ] Only the exact authenticated Candidate workspace host can obtain a confirmed initial projection or later refresh; every other or malformed host receives a neutral unavailable result before session detail or recruiter status is read or disclosed.
- [ ] Confirmed status output, rendered content, destinations, browser storage, analytics, and ordinary logs contain none of the prohibited identifiers or submitted business fields.
- [ ] Status retrieval failure leaves the Candidate workspace usable and exposes only the non-actionable checking-status placeholder.
- [ ] A failed or cancelled navigation attempt releases the activation lock and permits a later retry; an accepted attempt never produces a duplicate opening.
- [ ] Multi-company and stale-approval cases use only current account-scoped entitlement and never disclose or grant cross-company authority.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The complete four-state acceptance matrix produces the correct label, availability, and high-level destination in 100 percent of tested entitlement and request-history cases.
- **SC-002**: Under the validation protocol below, elapsed time from the start of an authenticated Candidate workspace navigation until the first rendered frame where the theme and profile controls are operable and the recruiter-action footprint is visible as either a confirmed action or the safe checking placeholder is P95 within 3 seconds.
- **SC-003**: Under the validation protocol below, elapsed time from an accepted interval, focus, or visibility refresh opportunity until the confirmed label and action availability are visibly updated in the header is P95 within 2 seconds.
- **SC-004**: At 1440, 1024, 1023, 761, 760, 479, and 320 CSS pixels and at 200 percent text zoom, 100 percent of required controls remain reachable with no overlap, clipped action label, or page-level horizontal overflow.
- **SC-005**: Mouse, touch, Enter, and Space tests produce exactly one opening for every enabled state and zero openings for pending, loading, unavailable, and busy states.
- **SC-006**: Automated and manual accessibility validation reports zero serious or critical issues, complete keyboard reachability, visible focus in both themes, and no state communicated by color alone.
- **SC-007**: Privacy validation finds zero prohibited identifiers or submitted business fields in exposed status data, rendered content, destinations, browser persistence, analytics, or ordinary logs.
- **SC-008**: In 100 percent of simulated status-read failures, the Candidate workspace remains usable and no unconfirmed actionable recruiter state is shown.
- **SC-009**: Visible-workspace monitoring produces no overlapping status reads and no more than one interval-driven read per 30 seconds.
- **SC-010**: Existing Candidate search, theme switching, profile navigation, administrator management, profile account, and job-board regression checks retain their prior expected behavior.
- **SC-011**: At least 18 of the exactly 20 uncoached eligible participants defined by the validation protocol, with exactly five assigned to each confirmed state, correctly identify both their recruiter status and whether an action is available within 5 seconds after the header becomes visible.

### Validation Protocol

- **Representative population**: Use at least 100 authenticated Candidate accounts, with at least 25 accounts in each confirmed state. The population includes every mapped request lifecycle, no-request and stale-approval histories, deterministic timestamp ties, active and inactive entitlement combinations, multi-company cases, long profile values, and missing-avatar cases.
- **Environment**: Use one fixed release-equivalent environment with documented compute, network, storage, dataset state, dependency conditions, and no debug instrumentation that changes user-visible timing.
- **Page-load measurement**: Complete exactly 20 warm-up page loads, then measure exactly 200 authenticated page loads with 20 concurrent Candidate sessions distributed across the representative population. Timing starts when authenticated workspace navigation starts and ends on the first rendered frame where the theme and profile controls are operable and the recruiter-action footprint is visible as either a confirmed action or the safe checking placeholder.
- **Refresh measurement**: Complete exactly 20 warm-up refreshes, then measure exactly 200 refresh opportunities. Every measured opportunity starts from a confirmed state and changes to a different confirmed result whose label or availability differs. Allocate exactly 50 samples to each resulting state; allocate 66 or 67 samples to each of interval, focus, and visibility triggers; and allocate 16 or 17 samples to each trigger-by-result-state cell. Timing begins when the client accepts the eligible refresh opportunity and ends on the first rendered frame where the expected label and action availability are visibly presented.
- **Calculation and errors**: Calculate P95 using nearest-rank over the complete measured sample. Record P50, P95, P99, maximum, sample size, duration, concurrency, warm-up, and unplanned error rate. A run is invalid if unplanned errors exceed 0.5 percent; authorization, privacy, host-boundary, and state-correctness checks still require 100 percent success.
- **Usability measurement**: Use exactly 20 uncoached participants who used an online job-search or application service during the previous 12 months, can use the product language under test, did not implement or review this feature, and have not seen the study materials. Include 10 participants who primarily use mobile and 10 who primarily use desktop/laptop for online job seeking, and assign exactly five participants to each confirmed state. Begin timing when the complete header becomes visible and count success only when the participant correctly states both the recruiter status and whether the action is available within five seconds.

## Assumptions

- Existing recruiter-verification requests and company memberships remain the authoritative sources; this feature does not redefine their lifecycle or approval rules.
- The existing Candidate session mechanism remains the only browser session and already provides server-side expiration, revocation, logout, account-state enforcement, password-reset revocation, and secure cookie persistence.
- Existing recruiter-application, reapplication, Candidate profile, theme, search, and recruiter-workspace entry destinations remain available and enforce their own current authorization.
- A current active membership in an active verified company reflects prior approved employer verification; a historical approved request alone does not grant current recruiter entitlement.
- Exact English labels are part of this Group 1 contract. Localization is outside the current scope.
- Representative performance and usability evidence follows the fixed validation protocol above and records every stated condition and raw outcome.
- All four user stories are Priority P1 and must be complete before Group 1 is releasable, even though each can be validated independently.
