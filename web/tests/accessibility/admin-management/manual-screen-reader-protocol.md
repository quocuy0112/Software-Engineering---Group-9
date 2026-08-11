# Feature 006 manual screen-reader protocol

Automated checks do not replace this release gate. Record tester, date, browser,
screen-reader version, viewport, build reference, and evidence link for every
run. Do not mark a row passed without executing it.

## Environments

- NVDA current stable with Firefox current stable on Windows, desktop viewport.
- VoiceOver with Safari current stable on macOS, desktop viewport.

## Journeys

For each environment, complete login/two-factor, dashboard drill-down, account
session revocation, account suspend/reinstate, membership suspend/remove,
verification evidence review and decision, moderation assignment/resolution,
and recruiter company selection.

Verify for every journey:

1. headings and landmarks announce a useful hierarchy;
2. every control has a unique meaningful name and current state;
3. keyboard focus is visible, trapped inside modal dialogs, and restored to the
   invoker on close;
4. errors and async success/failure states are announced without moving focus
   unexpectedly;
5. state and priority are conveyed by text/icon as well as color;
6. tables expose headers and row actions with their target;
7. evidence controls announce loading, unavailable state, preview, and download;
8. no hidden or stale protected content is announced after logout, authority
   loss, Back/Forward, or reload.

## Evidence template

| Environment | Journey | Keyboard complete | Names/states correct | Focus correct | Announcements correct | No protected stale content | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NVDA / Firefox | | | | | | | NOT RUN | |
| VoiceOver / Safari | | | | | | | NOT RUN | |

Release requires every row to be `PASS` and zero unresolved serious or critical
findings.
