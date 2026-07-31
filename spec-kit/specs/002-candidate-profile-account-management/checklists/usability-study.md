# Representative usability study

Status on 2026-07-31: **PROTOCOL READY / PARTICIPANT STUDY NOT EXECUTED**.

T137 and SC-003 are intentionally not marked complete. This implementation
session has no recruited representative participants, moderator, consent
record, or live study environment. Automated tests and an AI walkthrough are
not substitutes for first-attempt human usability evidence.

## Decision rule

The study passes only when at least 90% of representative participants complete
**each** of the four primary tasks on their first attempt without assistance.
Results are calculated separately for every task:

```text
task completion rate =
  unassisted first-attempt completions / participants who attempted the task
```

Use at least 10 participants who all attempt all four tasks. With 10
participants, at least 9 must independently complete each task. Do not average
the four rates, discard failures, replace a participant after seeing a result,
or count a moderator-assisted completion as a pass.

## Representative sample

Recruit adults who currently seek work, recently applied for work, or maintain
an online professional profile. Exclude project contributors and anyone who has
already rehearsed these Feature 002 tasks.

The 10-person minimum sample must include:

- at least five participants who primarily use Vietnamese and at least three
  who primarily use English;
- at least five who normally perform account tasks on a phone and at least
  three who normally use a desktop/laptop;
- a mix of low, medium, and high confidence with online account settings;
- at least two participants who normally use keyboard-only navigation, browser
  zoom, reduced motion, a screen reader, or another relevant accessibility
  accommodation; and
- no more than two participants from the same project/team/class cohort.

Record only a pseudonymous participant code and these coarse recruitment
attributes. Do not record employer, precise disability/medical information,
real account credentials, personal email, profile contents, or screen captures
containing personal data.

## Environment and controls

- Use the documented local/staging build and record its commit identity,
  browser/assistive-technology version, operating system, viewport, language,
  input mode, and date.
- Use one fresh controlled account per participant, capture email, disposable
  profile data, and a second controlled session/device prepared in advance.
- Seed only the starting state stated in each task. Do not expose admin,
  database, developer-tool, or email-capture internals to the participant.
- Randomize the order of the four tasks with a balanced order so learning from
  one workflow does not systematically benefit another.
- Give the task prompt verbatim. The moderator may ask the participant to think
  aloud but may not name controls, point, navigate, restate validation, or
  explain the workflow during the first attempt.
- Start timing after the participant finishes reading the prompt. Stop at the
  observable completion condition or at the task-specific time limit.

The moderator may stop a task for safety, distress, accidental use of personal
data, or a technical environment failure. Mark a genuine environment failure
as invalid and rerun that same participant later without changing the
interface. Do not classify an interface error, unclear state, validation
problem, or inaccessible control as an environment failure.

## First attempt and assistance rules

A first attempt begins with the first interaction after the prompt and ends
when the success condition is met, the participant asks for workflow help, the
moderator intervenes, the time limit expires, or the participant declares they
cannot continue.

Allowed without counting as assistance:

- repeating the prompt word for word;
- resolving a study-hardware failure unrelated to the product;
- reminding a think-aloud participant to keep talking; and
- responding that the moderator cannot explain the interface during the task.

Counts as assistance and therefore fails the unassisted criterion:

- pointing out or naming a control, destination, validation rule, or next step;
- suggesting reload, retry, another session/device, or email verification;
- interpreting a status, error, mandatory setting, or session result; or
- correcting participant-entered task data.

Backtracking, self-correction, reading inline help, and recovering from a
product validation message remain unassisted if the participant does them
independently within the time limit.

## Task scripts and completion conditions

### U1 — Complete and reorder a professional profile

Prompt:

> Add the supplied headline, summary, phone, location, two skills, one work
> experience, one education entry, and one social link. Put the second supplied
> skill first, save your work, then confirm it is still present after a reload.

Starting state: signed-in candidate with an empty profile and a printed sheet of
fictional valid data.

Completion: all supplied data persists after reload, skill order is correct,
and no duplicate or unsaved item remains. Time limit: 12 minutes.

Observe navigation between sections, interpretation of explicit Save actions,
reordering, validation recovery, persistent feedback, and reload confidence.

### U2 — Update identity and complete an email change

Prompt:

> Change the account name to the supplied name. Request the supplied replacement
> email, use the verification message to complete the change, and confirm which
> email now belongs to the account.

Starting state: signed-in candidate, supplied current password, controlled old
and proposed mailboxes, no pending email change.

Completion: new name and effective email are visible, the pending state is
cleared, and the participant correctly identifies the new email as
authoritative. Time limit: 10 minutes.

Observe separation of professional profile and identity, current-password
prompt, queued/pending meaning, message selection, fragment verification, and
final state.

### U3 — Change preferences and verify cross-session persistence

Prompt:

> Change the interface language and timezone to the supplied choices. Turn off
> application-update and job-recommendation email, keep required security email,
> save, and confirm the same choices in the already prepared second session.

Starting state: default preferences and a second authenticated controlled
session.

Completion: both sessions show the supplied language/timezone and optional
email choices, and security email remains enabled. Time limit: 6 minutes.

Observe the mandatory disabled setting, complete-set Save behavior, feedback,
and independent verification rather than assumed browser-only persistence.

### U4 — Change the password and understand the result

Prompt:

> Change the account password from the supplied current password to the supplied
> valid new password. Confirm that this session still works, the prepared second
> session no longer works, and explain what the confirmation message means.

Starting state: two authenticated sessions, controlled effective mailbox, and
supplied non-personal passwords.

Completion: the initiating session remains usable, the second session is
rejected, the participant finds the confirmation capture, and accurately
states that the password changed and other sessions were signed out. Time
limit: 8 minutes.

Observe password guidance, confirmation/reveal controls, duplicate-submit
confidence, completed-state wording, session verification, and notification
interpretation.

## Observation form

Create one row per participant and task. Use UTC timestamps and pseudonymous
codes.

| Participant | Task | Order | Device / viewport | Language | Input / accommodation | First-attempt completion | Assistance | Time | Observed blocker / note     |
| ----------- | ---- | ----: | ----------------- | -------- | --------------------- | ------------------------ | ---------- | ---: | --------------------------- |
| Not run     | —    |     — | —                 | —        | —                     | —                        | —          |    — | No participant evidence yet |

For a failure, record the first blocking behavior and the visible state that
preceded it. Do not infer motivation. Record critical accessibility or security
problems immediately and stop affected testing if continuing could expose
data.

## Results summary template

| Task                    | Attempted | Unassisted first-attempt completions |         Rate | 90% threshold | Decision      |
| ----------------------- | --------: | -----------------------------------: | -----------: | ------------: | ------------- |
| U1 Professional profile |         0 |                                    0 | Not measured |        >= 90% | NOT EVALUATED |
| U2 Identity/email       |         0 |                                    0 | Not measured |        >= 90% | NOT EVALUATED |
| U3 Preferences          |         0 |                                    0 | Not measured |        >= 90% | NOT EVALUATED |
| U4 Password/session     |         0 |                                    0 | Not measured |        >= 90% | NOT EVALUATED |

After all sessions, group observed blockers by task and severity, link each
remediation to a tracked change, and rerun affected tasks with a newly recruited
representative sample. Mark T137 and SC-003 complete only when every task meets
the threshold with the raw pseudonymous observation rows retained in the
approved study repository.
