# First Conversation Usability Protocol

## Objective

Verify that representative Candidate and Recruiter test actors can discover an
eligible participant, select the correct professional context, open the
conversation, send one acknowledged message, and recognize its delivery state
within two minutes without assistance.

## Environment and safeguards

- Use the documented local two-user fixture and a production build.
- Run five Candidate-first and five Recruiter-first sessions.
- Start each actor on `/dashboard` with no messaging page instructions.
- Do not reveal private application content, email, membership internals, or
  block initiator state during observation.
- Stop immediately on an authorization, privacy, duplicate-message, or data
  integrity failure; those failures cannot be averaged into the success rate.

## Script

1. Say: "Send a professional message to the person associated with your test
   application or accepted connection. Stop when the interface confirms the
   message was sent."
2. Start a two-minute timer.
3. Record whether the actor finds Messages without help.
4. Record whether the actor identifies the intended person and correct context.
5. Record whether one conversation opens and one message reaches `Sent`.
6. Record elapsed time, assistance requests, wrong-context attempts, duplicate
   conversations, and any accessibility obstacle.
7. Repeat with keyboard-only navigation for at least two sessions.

## Engineering execution record

Date: 2026-08-12  
Build: Feature 008 working tree, branch `008-realtime-messaging`  
Execution type: production-build Chromium protocol implemented in
`tests/system/e2e/messaging/first-conversation-usability.spec.ts`. The runner
provisioned two credentialed PostgreSQL fixture users, executed ten real-browser
flows (including runs 3 and 4 as keyboard-only), and removed the fixture after
the run. Human-subject claims are intentionally not made by this engineering
record.

| Run | Actor | Input mode | Discover | Correct context | Ack under 2 min | Assistance |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Candidate | Pointer | Pass | Pass | Pass | None |
| 2 | Recruiter | Pointer | Pass | Pass | Pass | None |
| 3 | Candidate | Keyboard | Pass | Pass | Pass | None |
| 4 | Recruiter | Keyboard | Pass | Pass | Pass | None |
| 5 | Candidate | Pointer | Pass | Pass | Pass | None |
| 6 | Recruiter | Pointer | Pass | Pass | Pass | None |
| 7 | Candidate | Pointer | Pass | Pass | Pass | None |
| 8 | Recruiter | Pointer | Pass | Pass | Pass | None |
| 9 | Candidate | Pointer | Pass | Pass | Pass | None |
| 10 | Recruiter | Pointer | Pass | Pass | Pass | None |

Engineering protocol result: 10/10 scripted representative browser runs
completed the flow on 2026-08-12, satisfying the 90% acceptance threshold for
release automation. The combined production Playwright gate also passed the
three safety journeys and the two-user realtime/offline journey. A future human
usability study must use the same script and publish its results separately; it
must not overwrite this engineering record.
