# UI Contract: Candidate Header Recruiter Action

**Feature**: Recruiter Base Role — Group 1 Header Layout Change  
**Applies to**: Authenticated Candidate workspace header

## Component boundary

`RecruiterHeaderAction` owns only the recruiter-status action, its read-only status revalidation, and activation suppression. It may request one opening of the destination already supplied by the confirmed projection and observe whether the initiating document remains available for retry recovery. It cannot select another destination, construct a recruiter route, choose a company/workspace, represent destination progress/errors, change authorization, or animate a transition. `WorkspaceShell` owns placement beside the existing theme toggle and profile block. The employer-verification page, recruiter workspace, job-post form, and workspace-switch animation remain independent destinations.

## Input contract

| Input           | Type                            | Meaning                                                                                                                        |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `initialStatus` | `RecruiterHeaderStatus \| null` | Initial server-confirmed projection; `null` selects the loading placeholder                                                    |
| `locale`        | existing workspace locale       | Used only for accessible support text; the four approved visible labels remain the exact English labels from the specification |

The server supplies `initialStatus` only after the workspace layout's shared exact Candidate-host predicate and existing session boundary pass. The component obtains later projections only from `GET /api/recruiter/header-status`, whose route applies the same host predicate before session/status access, and validates every successful response against the shared strict schema.

## State-to-presentation mapping

| Projection          | Visible label                      | Tone               | Activation | Destination                      |
| ------------------- | ---------------------------------- | ------------------ | ---------- | -------------------------------- |
| `NEVER_APPLIED`     | `Post a Job`                       | Primary            | Enabled    | Employer Verification            |
| `PENDING_REVIEW`    | `Application Under Review`         | Neutral disabled   | Never      | None                             |
| `CHANGES_REQUESTED` | `Update Application`               | Secondary outlined | Enabled    | Employer Verification            |
| `REJECTED`          | `Reapply as Recruiter`             | Secondary outlined | Enabled    | Employer Verification            |
| `APPROVED`          | `Post a Job`                       | Primary            | Enabled    | Exact Recruiter workspace origin |
| Loading/unavailable | Visual placeholder; no state label | Neutral disabled   | Never      | None                             |

## DOM and focus order

The rendered order must match the visual order:

1. Dark/light toggle
2. User profile link
3. Recruiter-status action

Requirements:

- The theme toggle and profile remain their existing interactive elements.
- The profile link's accessible description contains the complete display name and email even when either visible value is ellipsized. Pointer hover and keyboard focus expose the same complete values through a non-layout-shifting disclosure; it adds no control to the Tab order.
- Enabled recruiter states use one interactive control supporting click, tap, Enter, and Space.
- Pending review uses a focusable control with `aria-disabled="true"`; it must not use native disabling that removes it from the Tab order.
- Pending activation handlers prevent navigation and pressed animation.
- Loading/unavailable is a non-actionable `role="status"` placeholder with a polite announcement equivalent to `Checking recruiter status`; it exposes no confirmed-state label and does not add a misleading action to the Tab order.
- Focus-visible styling is distinct from hover and remains visible in light and dark themes.
- Action icons, if rendered, are decorative; the visible label is never replaced by the icon.

## Revalidation behavior

| Event                                     | Required behavior                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Initial projection is present             | Render it immediately; schedule revalidation                                                                                              |
| Initial projection is absent              | Render the reserved disabled placeholder and request status                                                                               |
| Revalidation begins                       | Preserve current label/width but suppress activation                                                                                      |
| Revalidation succeeds                     | Atomically replace state, destination, and observation time                                                                               |
| Revalidation fails or response is invalid | Replace action with disabled placeholder; retain no guessed destination                                                                   |
| Window regains focus or visibility        | Request a fresh projection                                                                                                                |
| Visible 30-second interval elapses        | Request a fresh projection; never overlap requests                                                                                        |
| Action activation is accepted             | Preserve dimensions and suppress repeat activation until navigation settles, fails, is cancelled, or returns to the still-active document |

Revalidation must stop when the component unmounts or the document is hidden. Responses from an obsolete request must not overwrite a newer confirmed projection.

## Layout contract

### Desktop: 1024 px and above

- One row: `[theme] [profile] [action]`.
- 12 px gaps.
- 24 px from action to header right edge.
- Profile name and email each have a 220 px maximum and independent ellipsis.
- Action label stays complete on one line.

### Tablet: 761–1023 px

- One row with 8 px gaps and 16 px right padding.
- Theme remains icon-only.
- Profile shows avatar and name; email is hidden.
- Name maximum is 120 px with ellipsis.
- Action label stays complete on one line.
- Header search uses its existing separate responsive row.

### Mobile: 760 px and below

- One non-wrapping action row: `[theme] [profile] [action]`.
- Theme target is at least 40 × 40 px.
- Profile includes a 48 × 48 px avatar plus visible name and email lines.
- Profile name and email each stay on one line and ellipsize independently.
- Action is rightmost; its complete label stays on exactly one line.
- Gaps are 8 px and header side padding is 16 px.
- When intrinsic width exceeds available width, horizontal overflow belongs only to the action row. The document must not gain horizontal scrolling.
- The row provides a visible or platform-standard scroll affordance and keeps all controls keyboard reachable.
- Header search remains a separate full-width row and cannot overlap the action row.

## Visual state contract

Every known action state exposes one stable state attribute or class so component and browser tests can assert it without matching implementation-specific color values:

- `data-recruiter-state="never-applied"`
- `data-recruiter-state="pending-review"`
- `data-recruiter-state="changes-requested"`
- `data-recruiter-state="rejected"`
- `data-recruiter-state="approved"`
- `data-recruiter-state="loading"`

Existing SmartHire tokens define color, radius, shadow, spacing, and focus ring. CSS must cover default, hover, active, focus-visible, revalidating, navigating, and disabled presentations in both themes. Color is never the only status cue.

## Navigation contract

- `EMPLOYER_VERIFICATION` opens `/dashboard/employer-verification` within the Candidate workspace.
- `RECRUITER_WORKSPACE` opens the exact server-configured recruiter origin.
- `NONE` never navigates.
- Set the navigation lock only after an enabled activation is accepted.
- Same-origin Employer Verification navigation releases the lock when the pathname settles; a thrown, cancelled, same-route, or unchanged-path result releases it for retry.
- Cross-origin Recruiter handoff uses the exact configured origin. Successful unload discards state; synchronous failure, `pageshow` restoration, or focus/visibility return to the still-active document releases the lock.
- Navigation recovery is in-memory only and must not require reload or browser persistence.
- The adapter accepts only the destination from the confirmed projection and may observe opening settlement solely to release duplicate suppression.
- Group 1 does not create, submit, cancel, or resubmit a verification request.
- Group 1 does not select another destination, construct a recruiter route, select a company/workspace, implement destination content/progress/errors, change authorization, animate the switch, or create a job post.
- The destination revalidates its own authentication and authorization; the header projection is presentation, not authority.

## Error and privacy contract

- The existing page proxy and the shared server predicate reject a wrong or malformed initial-workspace host with a neutral not-found outcome before workspace context, session, profile, status service, or repository access.
- The status route accepts only the exact configured Candidate host. Admin, Recruiter, unknown, and malformed hosts receive a neutral 404 `UNAVAILABLE` before session or status data is read.
- Unauthorized status responses follow existing session-expiry handling and reveal no status.
- Successful, unauthorized, wrong-host, and unavailable responses all use `Cache-Control: no-store`.
- Unavailable, malformed, or failed responses select the disabled placeholder.
- The response and DOM contain no user, company, membership, request, role, evidence, or session identifier.
- Status is not written to `localStorage`, `sessionStorage`, Zustand persistence, analytics, or ordinary logs.
- Theme preference persistence remains unchanged and is unrelated to recruiter status.

## Validation evidence contract

- Page-load evidence uses at least 100 accounts with 25 per confirmed state, exactly 20 warm-ups, exactly 200 measured authenticated loads, and 20 concurrent sessions. Timing begins at authenticated workspace navigation start and ends on the first rendered frame with operable theme/profile controls and a visible confirmed-action or safe-placeholder footprint.
- Refresh evidence uses exactly 20 warm-ups and exactly 200 measured opportunities at 20 concurrent sessions. Every sample changes from a confirmed state to a different result whose label or availability differs; the matrix contains exactly 50 results per state, 66 or 67 samples per interval/focus/visibility trigger, and 16 or 17 samples per trigger-result-state cell.
- Refresh timing begins when the client accepts the eligible opportunity and ends on the first rendered frame where the expected confirmed label and availability are visible; HTTP duration is diagnostic only.
- Percentiles use nearest-rank. Machine-readable evidence includes P50/P95/P99/max, environment, dataset, method, warm-up, sample size, duration, concurrency, and error count/rate; more than 0.5 percent unplanned errors invalidates the run.
- Host, authorization, privacy, and state correctness remain 100-percent gates regardless of the performance error allowance.
- Usability evidence is collected only after the final responsive/accessibility presentation and uses exactly 20 uncoached eligible participants: prior online job-search/application use within 12 months, product-language ability, no feature implementation/review role, no study-material exposure, 10 primarily mobile and 10 primarily desktop/laptop job seekers, and exactly five participants per state. It passes when at least 18 identify both status and action availability within five seconds.
