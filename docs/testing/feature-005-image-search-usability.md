# Feature 005 Image-Assisted Search Usability Protocol

Status: approved protocol; participant execution evidence is not yet recorded.

## Purpose and release rule

This protocol measures whether representative users can independently turn a
job-poster image into understandable, editable public-job filters. It does not
measure OCR accuracy, model quality, or participant suitability.

The study requires 30 completed participants: 15 using a desktop viewport of at
least 1280 by 720 pixels and 15 using a fixed 320 by 720 pixel viewport. At
least 27 of the 30 participants must complete every scored step correctly on
their first attempt without facilitator help. Results are reported only as
anonymous aggregate counts; recordings, uploaded images, OCR text, search
values, names, contact details, IP addresses, and participant-level rows are
prohibited evidence.

## Recruitment and consent

- Recruit adults who have searched for a job online in the previous two years.
- Include participants comfortable with Vietnamese, English, and mixed
  Vietnamese/English content across both viewport cohorts.
- Exclude project contributors and anyone who has seen the Feature 005 UI.
- Assign a random session number used only during facilitation; destroy the
  participant/session mapping before aggregating results.
- Read: “This study evaluates the interface, not you. Do not upload personal or
  real recruitment material. You may stop at any time. We retain only aggregate
  success counts and environment information.”
- Record only consent count (`30`) and withdrawal count. Do not record consent
  signatures in the repository.

## Fixed environment

- Use the release candidate commit and record its Git SHA.
- Use only committed synthetic fixtures: one Vietnamese, one English, and one
  bilingual poster, balanced across cohort assignments.
- Start every session with no image query in progress, external interpretation
  unselected, empty browser storage, and a documented ordinary text query
  already visible in the search form.
- Desktop cohort: 1280×720 or larger. Mobile cohort: exactly 320×720.
- Enable reduced motion for one third of each cohort and keyboard-only input for
  at least five participants in each cohort.
- Do not coach, point, paraphrase controls, or correct an action during the
  first attempt. A participant who asks for operational help fails that scored
  step; the facilitator may then assist so the session can continue.

## First-attempt task

Ask each participant to:

1. Find the control for searching from a job-poster image.
2. Explain, before uploading, what is processed, why it is processed, the
   deletion period, and whether external interpretation is currently enabled.
3. Attach the assigned synthetic PNG/JPEG.
4. Identify that processing is active and locate the cancel action.
5. Distinguish an automatically selected high-confidence filter from a filter
   requiring review.
6. Edit one proposal, remove another, and keep the existing manual criterion.
7. Apply the selected proposals and explain why the results changed.
8. Return and start another image, cancel it, then demonstrate that ordinary
   text search remains usable.

For the external-consent variant, ask the participant to opt in, explain the
destination and text-only boundary, revoke while processing, and identify the
local/manual recovery path. Never use a real provider payload in study
evidence.

## Scoring rubric

A session is a complete first-attempt success only when all eight tasks are
completed without assistance and all of these safety-critical explanations are
correct:

- the image is used only to propose public job-search filters;
- image/OCR artifacts are temporary and deleted within 15 minutes;
- external interpretation is initially off and sends recognized text only;
- proposed filters are editable/removable and do not silently overwrite manual
  criteria;
- the feature does not identify people or assess candidates;
- ordinary manual search remains authoritative and available.

Record one aggregate failure reason per failed session using only these codes:
`DISCOVERY`, `PRIVACY_COMPREHENSION`, `UPLOAD`, `PROGRESS_CANCEL`,
`PROPOSAL_COMPREHENSION`, `EDIT_PRESERVATION`, `RESULT_EXPLANATION`, or
`RECOVERY`. Do not add free-text participant notes.

## Aggregate evidence template

Store the completed, reviewed evidence at
`docs/testing/evidence/feature-005-image-search-usability-results.md` with this
exact content-safe structure:

```text
# Feature 005 Usability Aggregate Evidence

- Release candidate Git SHA:
- Study dates (UTC):
- Facilitator/reviewer roles (no names):
- Consent count:
- Withdrawal count:
- Desktop completed / first-attempt successes: __ / __
- 320-pixel completed / first-attempt successes: __ / __
- Total completed / first-attempt successes: __ / __
- Keyboard-only completed:
- Reduced-motion completed:
- Fixture language counts: VI __, EN __, bilingual __
- Aggregate failure codes: {}
- Prohibited-data review: PASS/FAIL
- Independent sign-off: PASS/FAIL
```

The evidence passes only if both cohorts contain at least 15 completed
participants, total completed is at least 30, total first-attempt successes are
at least 27, and the prohibited-data review plus independent sign-off both
pass. Missing or pending fields fail closed. The repository must never contain
fabricated participant results.
