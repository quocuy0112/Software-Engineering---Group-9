# Verification-review usability protocol

## Objective and pass threshold

Measure whether representative Platform Administrators correctly approve,
request changes, or reject a qualified request within 3 minutes. At least 90%
must finish correctly within 180 seconds. Every approval must create exactly
one intended membership and preserve Candidate identity.

## Participants and dataset

- Recruit at least 10 administrators who did not implement Feature 006.
- Balance new-company approval, existing-company approval with a valid
  prerequisite, request changes, and rejection tasks.
- Include close company names, an existing tax-ID match, evidence history, and
  one non-actionable viewer-outage control.

## Procedure

1. Start at the unassigned verification queue and read the requested outcome.
2. Start the timer when the participant selects the request.
3. Observe evidence controls, prerequisite inspection, decision selection,
   required reason/category, private-note understanding, confirmation, step-up,
   and conflict recovery without coaching.
4. Stop at commit, 3:00, wrong-target action, or request for help.
5. Verify state/history/audit/outbox atomically and membership/Candidate state
   for approvals.

## Outcome sheet

| Participant | Scenario | Correct first attempt | Seconds | Correct request | Correct outcome | One membership | Candidate preserved | Notes |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| | | | | | | | | |

Record `PASS` only when at least 90% finish correctly within 180 seconds and
all approval integrity columns are true.
