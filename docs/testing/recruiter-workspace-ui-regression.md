# Recruiter workspace UI regression checklist

Use an approved recruiter account with a linked company. Run the checks at a
desktop width and at a narrow mobile width where the form becomes one column.

## Workspace and Post a job flow

- [ ] From Dashboard, activate `Post a Job`; the recruiter workspace renders
      without job-board search or job-board layout rules.
- [ ] From Profile, activate `Post a Job`; the same recruiter UI renders.
- [ ] From the Jobs/job-postings route, activate `Post a Job`; the sidebar,
      form, and live preview remain aligned with no overlay or blank region.
- [ ] Open the create form and use Cancel/back; the job-posting list returns
      without losing the sidebar or main-content width.
- [ ] Confirm the recruiter sidebar contains Overview, Job postings,
      Candidates, Company settings, and Sign out, with no bottom Candidate
      workspace action.
- [ ] Confirm the only workspace switcher is beside the account name/email and
      that its label changes between Candidate workspace and Recruiter
      workspace.

## Persistence and navigation

- [ ] Switch to Recruiter workspace, reload on the dashboard, and confirm the
      recruiter label, sidebar, and job-posting data are shown immediately.
- [ ] Switch to Recruiter workspace, reload a deep link such as a job detail
      URL, and confirm the selected workspace does not flash to Candidate.
- [ ] Open a new tab and confirm it starts in the persisted selected workspace.
- [ ] Switch back to Candidate through the header switcher, reload, and confirm
      Candidate navigation is restored.
- [ ] Log out and sign in again; confirm the cleared preference returns to the
      default Candidate workspace.

## Form controls

- [ ] Toggle Nationwide remote, Work on Saturday, and Urgent hiring repeatedly;
      each switch changes only its own value, with no route change, tab change,
      scroll jump, or sidebar overlap.
- [ ] Repeat the toggle checks while scrolled near the top, middle, and bottom
      of the form, and immediately after opening another form section.
- [ ] Confirm the live candidate preview updates for each toggle without
      moving the form or preview columns.
- [ ] Select and deselect every benefit card. The icon badge remains visible,
      the selected card uses the selected styling, and the small check stays in
      the fixed corner.
- [ ] Select the long lunch/coffee benefit and confirm card heights, label
      alignment, and checkmark position remain consistent with neighboring
      cards.
- [ ] Confirm the candidate-facing benefit input expands smoothly only for a
      selected benefit and collapses when deselected.
