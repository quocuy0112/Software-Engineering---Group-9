# Profile and account accessibility results

Status on 2026-07-31: **AUTOMATED PASS / LIVE MANUAL AUDIT PENDING**.

T136 is intentionally not marked complete. The required in-app browser surface
was not attached to this session, so live keyboard and assistive-technology
observations have not been invented from source inspection.

## Automated evidence

Command:

`npm.cmd run test --workspace @smarthire/web -- tests/frontend/accessibility/professional-profile.accessibility.test.tsx tests/frontend/accessibility/account-identity-email-change.accessibility.test.tsx tests/frontend/accessibility/password-change.accessibility.test.tsx tests/frontend/accessibility/account-preferences.accessibility.test.tsx tests/frontend/accessibility/profile-account-contrast.accessibility.test.ts`

Result: **PASS, 5 files / 33 tests**.

The automated checks cover:

- programmatic names and appropriate input types for Profile collections,
  identity, email change, password change, and preferences;
- keyboard-addressable native buttons, links, fields, checkboxes, selects,
  collection movement/removal actions, and password visibility;
- persistent `role="status"`/`role="alert"` feedback, polite live regions,
  focus transfer to errors, retained invalid input, and cleared passwords after
  success;
- explicit text, roles, disabled state, borders, and warnings so meaning is not
  color-only;
- reduced-motion rules and 320 px-safe layout rules for all four stories; and
- executable WCAG contrast checks for representative text, feedback, links,
  focus indicators, and control boundaries.

The clean serial Playwright release matrix separately passed every Feature 002
journey at desktop and 320 px (8/8 Feature 002 variants; 40/40 overall).

## Contrast correction and measured ratios

The current design-token migration preserves the corrected non-text contrast
gaps. Profile/account focus treatment uses
`--sh-color-border-focus: #2563eb` plus
`--sh-color-focus-ring-bg: #dbeafe`; relevant input boundaries use
`--sh-color-border-default: #64748b`. The executable contrast test also rejects
the superseded legacy focus, boundary, and color tokens in Feature 002 styles.

| Pair                              |   Ratio | Requirement | Result |
| --------------------------------- | ------: | ----------: | ------ |
| Focus border / white card         |  5.17:1 |         3:1 | PASS   |
| Focus halo / blue primary control |  5.49:1 |         3:1 | PASS   |
| Control boundary / white card     |  4.76:1 |         3:1 | PASS   |
| Primary text / white card         | 17.85:1 |       4.5:1 | PASS   |
| Secondary text / white card       |  7.58:1 |       4.5:1 | PASS   |
| White button text / blue primary  |  6.70:1 |       4.5:1 | PASS   |
| Section kicker / white card       |  6.70:1 |       4.5:1 | PASS   |
| Success feedback text / fill      |  4.79:1 |       4.5:1 | PASS   |
| Warning feedback text / fill      |  4.76:1 |       4.5:1 | PASS   |
| Error feedback text / fill        |  5.91:1 |       4.5:1 | PASS   |

## Source and semantics review

| Area                | Evidence                                                                                                              | Status |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| Profile             | Labelled fieldsets and ordered controls; textual empty/save/conflict states; polite save region                       | PASS   |
| Identity/email      | Editable name separated from immutable definition list; proof removed from fragment; focused reusable-link error      | PASS   |
| Password            | Correct autocomplete; paste permitted; show-password checkbox; focused error/lock summary; secrets cleared on success | PASS   |
| Preferences         | Complete labelled set; mandatory security notification explained and disabled; focused persistent result              | PASS   |
| Non-color cues      | Status words, borders, roles, disabled state, current-page semantics, and warning copy accompany color                | PASS   |
| Reduced motion      | Feature styles disable transitions and animation under `prefers-reduced-motion: reduce`                               | PASS   |
| 320 px source rules | One-column reflow, bounded controls, wrapping, and max-width rules exist for each story                               | PASS   |

## Required live observations still pending

Run with a signed-in controlled candidate at desktop and 320 px, with reduced
motion both off and on:

| Manual observation                                                                           | Profile | Identity/email      | Password | Preferences |
| -------------------------------------------------------------------------------------------- | ------- | ------------------- | -------- | ----------- |
| Tab order follows visual/reading order, with no focus trap                                   | Pending | Pending             | Pending  | Pending     |
| Every focus ring is visibly distinguishable on actual computed backgrounds                   | Pending | Pending             | Pending  | Pending     |
| Success, validation, conflict, lock, and retry results are announced once by a screen reader | Pending | Pending             | Pending  | Pending     |
| Reorder/remove and disabled/mandatory state remain understandable without color              | Pending | N/A / Pending state | Pending  | Pending     |
| Reduced-motion mode removes non-essential motion in computed styles                          | Pending | Pending             | Pending  | Pending     |
| `scrollWidth <= clientWidth` at 320 CSS px after populated/error states                      | Pending | Pending             | Pending  | Pending     |

Record browser/assistive-technology versions, viewport, exact task, observed
focus sequence, announcement text, and overflow measurements before changing
T136 to complete.
