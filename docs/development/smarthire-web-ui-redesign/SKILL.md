---
name: smarthire-web-ui-redesign
description: Redesign, refactor, or review the SmartHire Next.js web interface so existing and new Candidate, Recruiter, Authentication, Profile, Job, Application, CV, and AI-evaluation screens conform to the approved SmartHire Figma system. Use for UI migration, component extraction, CSS/token cleanup, responsive layout work, visual consistency fixes, text overflow fixes, accessibility review, or implementation QA in apps/web.
---

# SmartHire Web UI Redesign

## Objective

Apply the approved SmartHire Figma language to the official web application without changing business rules, authentication ownership, API contracts, server boundaries, or use-case behavior.

Treat this document as the implementation contract for redesigning existing screens and building future screens. Keep visible product copy in English unless a later product requirement explicitly changes the language.

## Sources of truth

Use sources in this order:

1. Markdown use-case specifications decide behavior, permissions, state transitions, validation, and data visibility.
2. Figma decides visual language, layout, component naming, and design tokens.
3. Existing application code decides technical integration points and working behavior that must be preserved.
4. This skill decides the migration and verification process.

Figma references:

- File: [SmartHire](https://www.figma.com/design/NOLMbddMmI3Y9sLXkP5MYj/SmartHire)
- Design-system handoff: `62:17574` — `SmartHire Web Design System — Implementation Handoff`
- PA4 Must region: `62:13283` — `PA4 — Must UC — Candidate Profile & Job Board`
- Authentication page: `5:2` — `02 Authentication`
- Recruiter AI ranking reference: `43:2752`
- Candidate CV Match reference: `50:6505`
- Candidate Job Discovery reference: `62:14190`
- Candidate Job Detail reference: `62:14524`

Repository constraints:

- Use Next.js App Router, React 19, TypeScript, Tailwind CSS 4, and the current package set.
- Preserve Better Auth as the only browser-session owner.
- Preserve Route Handler → Service → Repository/Data Access → PostgreSQL boundaries.
- Do not move authentication policy into client components.
- Do not invent recruitment data on foundational identity pages.
- Do not change use-case specifications as part of a visual redesign.

## Current UI conflicts to remove

Audit these conflicts before implementing individual screens:

- `apps/web/src/app/globals.css` contains two competing visual systems and duplicated selectors.
- The old system uses `--forest`, `--violet`, `--mint`, `--sand`, and decorative green gradients that conflict with the blue SmartHire Figma system.
- Global font declarations mix Arial, Segoe UI, and Inter.
- Existing focus rings use amber values such as `#f59e0b` or `#c49b45`; Figma uses `#2563EB`.
- Existing workspace layout uses a 248 px/15.5 rem sidebar; Figma uses 220 px.
- Existing workspace top bar is approximately 91 px high; Figma uses 64 px.
- Existing content max width is 72 rem/1152 px; Figma uses 1172 px at the 1440 px desktop target.
- Existing controls use many arbitrary radii such as `0.4rem`, `0.6rem`, `0.7rem`, `0.75rem`, `0.9rem`, and `1.45rem`.
- Current navigation active states use translucent green and a left inset marker instead of the canonical blue active item.
- `workspace-navigation.tsx` contains mojibake such as `Ã—`, `â˜°`, and `Signing outâ€¦`; keep source files UTF-8 and replace these with valid Unicode or SVG icons.
- `apps/web/src/components/ui/` does not yet exist even though the architecture plan reserves it for shared UI.
- Several older selectors redefine the same Auth and Workspace classes later in the stylesheet. Do not layer another override block on top; consolidate the source.

## Semantic token contract

Use the existing Figma variable collection `Reqwise Tokens`. It contains 86 variables. Bind UI to semantic names; do not add raw colors inside feature components.

### CSS custom properties

Establish this contract once in `apps/web/src/app/globals.css` or an imported token stylesheet:

```css
:root {
  --sh-color-brand-primary: #1d4ed8;
  --sh-color-brand-primary-hover: #1e40af;
  --sh-color-brand-primary-pressed: #1e3a8a;

  --sh-color-surface-page: #f8fafc;
  --sh-color-surface-card: #ffffff;
  --sh-color-surface-subtle: #f1f5f9;

  --sh-color-text-primary: #0f172a;
  --sh-color-text-secondary: #475569;
  --sh-color-text-muted: #64748b;
  --sh-color-text-inverse: #ffffff;

  --sh-color-border-default: #cbd5e1;
  --sh-color-border-focus: #2563eb;
  --sh-color-focus-ring-bg: #dbeafe;

  --sh-color-success: #15803d;
  --sh-color-success-bg: #f0fdf4;
  --sh-color-warning: #a16207;
  --sh-color-warning-bg: #fefce8;
  --sh-color-error: #b91c1c;
  --sh-color-error-bg: #fef2f2;
  --sh-color-info: #1d4ed8;
  --sh-color-info-bg: #eff6ff;

  --sh-color-disabled-bg: #e2e8f0;
  --sh-color-disabled-text: #64748b;

  --sh-color-sidebar-background: #0f2a4a;
  --sh-color-sidebar-active: #1d4ed8;
  --sh-color-sidebar-text: #e2e8f0;
  --sh-color-sidebar-muted: #93c5fd;

  --sh-space-1: 4px;
  --sh-space-2: 8px;
  --sh-space-3: 12px;
  --sh-space-4: 16px;
  --sh-space-5: 20px;
  --sh-space-6: 24px;
  --sh-space-8: 32px;
  --sh-space-10: 40px;
  --sh-space-12: 48px;
  --sh-space-16: 64px;
  --sh-space-20: 80px;
  --sh-space-24: 96px;

  --sh-radius-sm: 8px;
  --sh-radius-md: 12px;
  --sh-radius-lg: 20px;
  --sh-radius-full: 999px;

  --sh-control-height-sm: 40px;
  --sh-control-height: 48px;
  --sh-control-height-lg: 56px;
  --sh-icon-size-sm: 16px;
  --sh-icon-size-md: 20px;
  --sh-icon-size-lg: 24px;

  --sh-canvas-width: 1440px;
  --sh-canvas-height: 1024px;
  --sh-sidebar-width: 220px;
  --sh-topbar-height: 64px;
  --sh-content-start-x: 244px;
  --sh-content-width: 1172px;
  --sh-card-padding: 24px;

  --sh-font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  --sh-font-size-display: 32px;
  --sh-font-size-h1: 28px;
  --sh-font-size-h2: 24px;
  --sh-font-size-h3: 20px;
  --sh-font-size-body: 16px;
  --sh-font-size-body-sm: 14px;
  --sh-font-size-label: 13px;
  --sh-font-size-caption: 12px;
  --sh-font-size-button: 15px;
  --sh-line-height-display: 40px;
  --sh-line-height-h1: 36px;
  --sh-line-height-h2: 32px;
  --sh-line-height-h3: 28px;
  --sh-line-height-body: 24px;
  --sh-line-height-body-sm: 20px;
  --sh-line-height-caption: 16px;
  --sh-font-weight-regular: 400;
  --sh-font-weight-medium: 500;
  --sh-font-weight-semibold: 600;
  --sh-font-weight-bold: 700;

  --sh-motion-fast: 120ms;
  --sh-motion-standard: 200ms;
  --sh-motion-deliberate: 320ms;
  --sh-breakpoint-mobile: 375px;
  --sh-breakpoint-tablet: 768px;
  --sh-breakpoint-desktop: 1280px;
  --sh-breakpoint-wide: 1440px;
  --sh-shadow-card: 0 1px 2px rgb(15 23 42 / 8%);
  --sh-shadow-floating: 0 8px 24px rgb(15 23 42 / 14%);
}
```

Use variables as the source of truth instead of maintaining parallel Paint, Text, Effect, or Grid styles. The Figma file currently has no independent styles in those four categories.

## Typography rules

Use Inter through `next/font` when implementation begins. Keep the following hierarchy:

| Role       | Size / line height | Weight |
| ---------- | -----------------: | -----: |
| Display    |            32 / 40 |    700 |
| Heading 1  |            28 / 36 |    700 |
| Heading 2  |            24 / 32 |    600 |
| Heading 3  |            20 / 28 |    600 |
| Body       |            16 / 24 |    400 |
| Body small |            14 / 20 |    400 |
| Label      |            13 / 18 |    500 |
| Caption    |            12 / 16 |    400 |
| Button     |            15 / 20 |    600 |

Do not use 12–13 px for normal body copy. Reserve it for labels, compact table metadata, captions, and breadcrumbs. Avoid extreme negative letter spacing.

## Canonical shells

### Candidate workspace

Use Figma components:

- `63:17971` — `Navigation/Candidate Workspace Sidebar/Jobs Active`
- `63:17986` — `Navigation/Candidate Portal Top Bar/Default`

Desktop geometry:

- Sidebar: 220 × 1024 px, `#0F2A4A`, 16 px horizontal padding.
- Top bar: x 220, width 1220 px, height 64 px.
- Main content: x 244, width 1172 px.
- Page background: `#F8FAFC`; card background: white.
- Put page titles and primary actions in the upper content area.
- Keep the active navigation route blue and all inactive navigation labels readable.

### Recruiter workspace

Use Figma components:

- `63:18154` — `Navigation/Recruiter Workspace Sidebar/Candidates Active`
- `63:18169` — `Navigation/Recruiter Portal Top Bar/Default`

Reuse Candidate geometry and interaction behavior. Change route labels and role-specific data only. Do not share private Candidate or Recruiter information across role boundaries.

### Authentication shell

Use the `02 Authentication` page and components `5:142` and `5:143` as the visual reference. Replace the green/forest marketing panel with the SmartHire dark-blue brand treatment. Keep the form area calm, white, and task-focused. Preserve all current semantic elements, labels, password-manager metadata, validation, and security behavior.

## Component implementation architecture

Create reusable primitives in `apps/web/src/components/ui/`. Keep feature composition in `apps/web/src/frontend/features/<feature>/components/`.

Recommended target structure:

```text
apps/web/src/
├── app/
│   ├── globals.css
│   └── layout.tsx
├── components/ui/
│   ├── alert.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── checkbox.tsx
│   ├── empty-state.tsx
│   ├── field.tsx
│   ├── input.tsx
│   ├── modal.tsx
│   ├── pagination.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   └── toast.tsx
└── frontend/features/
    ├── authentication/components/
    ├── candidate/components/
    ├── recruitment/components/
    └── jobs/components/
```

Keep component props semantic. Prefer `variant="primary"`, `tone="error"`, and `status="processing"` over raw class-name fragments or color props.

## Canonical Figma component catalog

Use these node IDs when comparing implementation with Figma. The catalog contains 124 existing components plus four canonical shell components.

### Form controls

```text
5:41 Text Input/Default                 5:50 Text Input/Focused
5:59 Text Input/Filled                  5:68 Text Input/Error
5:79 Text Input/Disabled                5:45 Password Input/Default
5:54 Password Input/Focused             5:63 Password Input/Filled
5:73 Password Input/Error               5:83 Password Input/Disabled
20:303 Select/Default                   20:308 Select/Focused
20:313 Select/Error                     20:319 Select/Disabled
5:131 Checkbox/Default                  5:133 Checkbox/Checked
5:132 Checkbox/Error                    5:137 Validation Message/Error
```

### Buttons, links, navigation, and shell

```text
5:88 Button/Primary/Default             5:92 Button/Primary/Hover
5:96 Button/Primary/Pressed             5:100 Button/Primary/Disabled
5:104 Button/Primary/Loading            5:90 Button/Secondary/Default
5:94 Button/Secondary/Hover             5:98 Button/Secondary/Pressed
5:102 Button/Secondary/Disabled         5:107 Button/Secondary/Loading
5:135 Text Link/Default                 5:143 Navigation/Auth Header
20:422 Settings Navigation/Default      20:425 Settings Navigation/Hover
20:428 Settings Navigation/Active       20:550 Navigation/App Header/Default
20:563 Account Menu/Open                5:142 Authentication Card
58:12713 Brand/SmartHire/Mark           63:17971 Candidate Workspace Sidebar
63:17986 Candidate Portal Top Bar       63:18154 Recruiter Workspace Sidebar
63:18169 Recruiter Portal Top Bar
```

### Feedback, status, and overlays

```text
5:110 Alert/Neutral                     5:113 Alert/Success
5:116 Alert/Warning                     5:119 Alert/Error
5:122 Password Requirement/Neutral      5:125 Password Requirement/Success
5:128 Password Requirement/Warning      5:140 Loading State
20:352 Toast/Success                    20:358 Toast/Error
20:364 Toast/Info                       20:370 Toast/Warning
20:380 Modal/Standard                   20:389 Modal/Destructive
20:398 Modal/Busy                       20:480 Empty State/Default
20:490 System Result/Access Denied      20:497 System Result/Not Found
20:504 System Result/Suspended          20:511 System Result/Service Error
20:572 System Result/Success            20:579 System Result/Invalid Link
20:586 System Result/Expired Link
```

### Upload, parser, tabs, profile, and progress

```text
20:328 Upload Area/Idle                 20:332 Upload Area/Drag Over
20:336 Upload Area/Selected             20:340 Upload Area/Processing
20:344 Upload Area/Error                20:412 Tabs/Default
20:415 Tabs/Active                      20:522 Parsed Field/Normal
20:528 Parsed Field/Low Confidence      20:534 Parsed Field/Conflict
20:540 Parsed Field/Accepted            20:435 Profile Section/View
20:440 Profile Section/Edit             20:447 Profile Section/Empty
20:456 Progress Status/Not Started      20:461 Progress Status/In Progress
20:466 Progress Status/Complete         20:471 Progress Status/Error
```

### Job discovery and actions

```text
30:3963 Search Field/Idle               30:3964 Search Field/Ready
30:3965 Search Field/Submitted          30:3981 Job Card/Default
30:4004 Filter Group/Expanded           30:4018 Active Filter Chip/Default
30:4021 Sort Select/Default             30:4026 Pagination/Default
30:4037 Job Availability Badge/Active   30:4039 Job Availability Badge/Closed
30:4041 Job Availability Badge/Unavailable
30:4047 Save Job Control/Unsaved        30:4049 Save Job Control/Saved
30:4051 Save Job Control/Loading        30:4053 Save Job Control/Error
30:4055 Share Job Action Sheet/Default  30:4070 Report Job Modal/Default
```

### Application journey

```text
30:4092 Application Status/Submitted    30:4094 Application Status/In review
30:4096 Application Status/Interview    30:4098 Application Status/Offer
30:4100 Application Status/Not selected 30:4102 Application Stage Timeline
30:4128 CV Selector/Default             30:4136 Application Question Field
30:4140 Consent Checkbox/Checked        30:4147 Recommendation Reason Chip
30:4150 Job Match Indicator/Default
```

### AI evaluation and ranking

```text
43:5289 AI Ranking/Filter/Wide          43:2668 AI Ranking/Filter/Default
45:5328 AI Ranking/Pagination/Page 1    45:5347 AI Ranking/Pagination/Page 2
43:2656 AI Ranking/Score Badge/High     43:2659 AI Ranking/Score Badge/Review
43:2662 AI Ranking/Score Badge/Low      43:2665 AI Ranking/Score Badge/Processing
43:2671 AI Ranking/Summary Card         43:2676 AI Ranking/Table Row/High
43:2695 AI Ranking/Table Row/Review     62:14175 Public Header/PA4 [DEPRECATED]
```

### Flow connectors

```text
21:2150 Connector/Basic                 21:2156 Connector/Alternative
21:2162 Connector/Exception             21:2168 Connector/Success
21:2174 Connector/Invocation            21:2180 Connector/Return
```

Do not use deprecated `62:14175` inside authenticated Job screens. Use the Candidate workspace shell.

## Required component state model

Implement applicable states in this order:

`Default → Hover → Pressed → Focus → Disabled → Loading → Success/Error`

For forms:

- Keep valid input after validation or transaction failure.
- Put field-specific errors next to the affected field.
- Add a form-level summary only when multiple fields fail or the transaction fails.
- Never show success when persistence fails.
- Clear password values after session expiry or security-sensitive failures when required.
- Disable duplicate submission while loading.
- Make Retry invoke the original action without discarding valid data.

For status badges:

- Use icon and text together.
- Reserve green for success/high fit, amber for warning/review, and red for error/low fit.
- Use neutral gray for pending or processing states.
- Never communicate state with color alone.

## Screen migration rules

### Authentication

Update `auth-shell.tsx`, authentication forms, and related selectors without changing request behavior. Keep Sign in, Register, Forgot password, Reset password, account recovery, email verification, TOTP, and backup-code flows distinct. Replace decorative forest/lavender styling with SmartHire blue, white cards, subtle borders, and the Figma focus treatment.

### Candidate workspace and Profile

Update `workspace-shell.tsx`, `workspace-navigation.tsx`, `profile-navigation.tsx`, Dashboard, Profile Overview, Security, and Sessions to the Candidate shell geometry. Preserve server-validated workspace context. Derive active navigation from pathname for presentation only.

### Recruiter workspace and AI ranking

Use the Recruiter shell. Keep page actions near the heading. Use sticky table headers for large ranked lists and controlled pagination instead of an unbounded page. Keep recruitment status and scoring status as separate aligned fields. Preserve explainable scores and human-decision notices.

### Job discovery and Job detail

Use Candidate shell components for authenticated screens. Preserve search terms and valid filter criteria during pagination, empty states, invalid filters, and retry. Closed or expired jobs remain viewable but cannot be applied to. Already-applied jobs show the application action instead of Apply.

### Application flow

Preserve confirmed profile/CV requirements, required answers, consent, review, duplicate-submission protection, and transaction recovery. Never display submission success when the job closes or the transaction fails before commit.

## File-by-file migration order

1. Consolidate tokens and global resets in `apps/web/src/app/globals.css`.
2. Load Inter in `apps/web/src/app/layout.tsx` and expose it through the token contract.
3. Add shared primitives under `apps/web/src/components/ui/`.
4. Refactor `workspace-shell.tsx` to the 220 px sidebar and 64 px top bar.
5. Refactor `workspace-navigation.tsx`; fix mojibake and preserve keyboard behavior.
6. Refactor `auth-shell.tsx` and shared Auth form primitives.
7. Migrate Profile, Security, Sessions, and Dashboard compositions.
8. Migrate Job, Application, CV, and AI feature compositions as those modules exist.
9. Remove obsolete selectors and the forest/lavender token block after all consumers migrate.
10. Run component, accessibility, navigation, E2E, typecheck, lint, and production-build checks.

Do not perform a single global search-and-replace of colors. Migrate by component family so states and accessibility remain testable.

## Responsive behavior

- Design desktop first at 1440 × 1024.
- At widths below 1280 px, preserve the content grid while reducing outer gutters.
- At tablet widths, collapse workspace navigation labels to icons or a controlled drawer.
- At mobile widths, use a top app bar and modal/drawer navigation; do not squeeze a 220 px rail beside content.
- Keep dialogs within `calc(100vw - 32px)` and ensure long content scrolls inside the dialog.
- Use pagination for large Candidate or Job lists. Do not create an endless page unless the use case explicitly requires infinite scrolling.
- Prevent horizontal overflow at 320 px except for intentionally scrollable data tables.

## Accessibility contract

- Meet WCAG AA contrast.
- Use a visible 2 px `#2563EB` focus ring with 2 px separation.
- Keep interactive targets at least 44 × 44 px.
- Maintain logical keyboard order and return focus after closing dialogs/drawers.
- Provide accessible names for icon-only controls.
- Use `aria-current`, `aria-expanded`, `aria-busy`, `aria-invalid`, and live regions only when semantically appropriate.
- Respect `prefers-reduced-motion`.
- Preserve heading hierarchy and landmark elements.
- Test zoom and text resizing; do not clip button labels or sidebar labels.

## Visual QA checklist

Before completing a screen, verify:

- The screen uses exactly one shell appropriate to its actor.
- Page actions are in the upper content area.
- Text does not overflow buttons, chips, cards, tabs, or navigation items.
- Sidebar labels are vertically centered and share one baseline.
- Filter labels such as Recruitment status and Scoring status remain on one line at desktop width.
- Cards use 20–24 px padding and 10–12 px radii unless a token specifies otherwise.
- Normal body text is at least 14 px.
- Disabled controls remain readable and do not rely only on opacity.
- Loading, empty, error, retry, and success states are present when required.
- Data tables have aligned columns, sticky headers where useful, and explicit pagination.
- No gradients or decorative marketing visuals compete with task content.

## Verification commands

Run from the repository root after implementation:

```powershell
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run test:unit
npm --workspace apps/web run test:compatibility
npm --workspace apps/web run build
npm --workspace apps/web run test:e2e -- --grep "navigation|workspace|auth|profile"
```

Also inspect at 1440 × 1024, 1280 px, 768 px, 375 px, and 320 px. Validate keyboard navigation, reduced motion, 200% zoom, long English content, loading states, and server failure recovery.

## Completion report

When finishing a redesign task, report:

- Files changed.
- Figma frames/components used as references.
- Tokens and reusable components introduced or reused.
- Existing visual conflicts removed.
- Responsive and accessibility checks completed.
- Automated checks executed and their results.
- Remaining visual or behavior limitations.
