# Account-security usability protocol

## Objective and pass threshold

Measure whether representative Platform Administrators can locate an account
and correctly complete one revoke-session, suspend-account, or reinstate-account
task on their first attempt within 2 minutes. The release threshold is at least
90% first-attempt completion and zero actions against the wrong account,
session, or company membership.

## Participants and dataset

- Recruit at least 10 administrators who did not implement Feature 006.
- Give each participant a different target from the representative dataset.
- Include two similarly named accounts and two company memberships per target.
- Do not coach after the timer starts.

## Procedure

1. Start recording at the dashboard and read the target account plus requested
   action aloud.
2. Stop after the first committed action, at 2:00, or when the participant asks
   for help.
3. Verify the target reference, session reference where applicable, resulting
   state, rationale category, audit correlation, and notification rule.
4. Reset the fixture before the next participant.

## Outcome sheet

| Participant | Action | First attempt | Seconds | Correct account | Correct session | No membership touched | Notes |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| | | | | | | | |

Record `PASS` only when first-attempt completion is at least 90%, every passing
time is at most 120 seconds, and every target/membership correctness column is
true. Attach anonymized observations to `release-validation.md`.
