# Validation Quickstart: Realtime Messaging and Communication

This guide defines the implementation-phase validation path. It contains no
production implementation code and assumes the tasks in `tasks.md` have been
completed.

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x`
- Docker with the existing PostgreSQL service available
- Feature 006 migrations applied
- Minimal Feature 007 dependency applied: canonical `ProfessionalConnection`
  pair, `ACCEPTED` state, and lookup provider used by `canMessage()`
- Two active normal accounts:
  - Candidate A with a submitted application
  - User B with an active approved recruiting membership in that application's
    company
- A second company/membership fixture for tenant-isolation denial

## Environment setup

From the repository root:

```powershell
npm ci
npm run env:init
npm run db:up
npm run db:deploy
npm run db:seed:jobs
```

Feature 008 uses the same origin, Better Auth cookie, PostgreSQL database, and
port `3001` as the existing application. Do not configure a JWT secret, Redis,
message broker, second database, or separate chat service.

## Start the application

```powershell
npm run dev:web
```

Expected startup evidence:

- one Node process listens on port `3001`;
- Next.js HTTP pages and `/api/messaging/**` respond through that process;
- the `/chat` Socket.IO namespace is attached to the same server;
- unauthenticated or wrong-origin namespace connections are rejected;
- existing non-messaging pages remain usable.

## Production entrypoint decision

Production executes the TypeScript custom server directly:

```powershell
npm run build
npm run start
```

The workspace `start` script runs
`node --conditions=react-server --import tsx server.ts`; exact `tsx` `4.23.1`
already is and remains a production `dependency`, not a `devDependency`. This is
deliberate: the repository already uses the same loader for production worker
entrypoints, and a production-only dependency install must still be able to
start SmartHire.
The rejected alternative was compiling `server.ts` into a separate `server.js`
artifact with `tsc` or esbuild, because that would add another build graph and
module-resolution path alongside Next.js. `next build` remains responsible for
the application build; `server.ts` remains transport composition only.

## Automated validation

Run focused checks first:

```powershell
npm run typecheck
npm run test:messaging
npm run test:messaging:e2e
npm run perf:messaging
```

Then run regression gates:

```powershell
npm run test:job-board
npm run test:admin-management
npm run build
```

Expected outcomes:

- messaging contract, unit, repository, gateway, frontend, accessibility,
  architecture, security, and performance suites pass;
- two-browser messaging E2E passes;
- job-board application authority and Feature 006 membership/session
  enforcement remain green;
- production build accepts the custom server entrypoint/deployment scripts.

## Manual scenario A: eligible application conversation

1. Sign in as Candidate A in Browser A.
2. Open `/messages` and choose User B under the specific application/job/company
   context.
3. In Browser B, sign in as User B and open the same context.
4. Create/open the conversation concurrently in both browsers.

Expected:

- both receive one authoritative conversation ID;
- the application, job, and company label is clear;
- another company context is not visible or selectable;
- safe participant fields are shown without email, application content, or
  membership internals.

## Manual scenario B: online send and read

1. Keep the conversation open in both browsers.
2. Send a valid plain-text message from A.
3. Observe the sender feedback and Browser B.
4. Let Browser B view the message and complete the read update.

Expected:

- A is not shown `Sent` until durable acknowledgement;
- B receives exactly one realtime message;
- conversation lists move to the top after commit;
- B's unread badge clears after accepted read;
- A sees `Read` within the SC-006 target;
- page source, URL, logs, and analytics contain no session credential or extra
  private application data.

## Manual scenario B2: list-only realtime delivery

1. Keep Browser B connected on the conversation list without opening A's thread.
2. Send a message from A in Browser A.

Expected:

- B receives exactly one `message:new` event because connect auto-joined all
  currently authorized conversation rooms;
- the list preview and unread badge update without B opening the thread;
- a later explicit thread join is idempotent and creates no duplicate event;
- a concurrent block/revoke prevents delivery through the emit-time
  `canMessage()` revalidation even if room removal races with the send.

## Manual scenario C: offline and reconnect recovery

1. Disconnect Browser B from the network.
2. Send two messages from A and confirm server acknowledgements.
3. Reconnect Browser B.
4. Reload the conversation and load an older page.

Expected:

- both accepted messages appear once and in stable sequence order;
- list unread count matches the two messages;
- REST reconciliation fills realtime gaps;
- cursor pagination returns at most 20 messages without duplicate boundaries;
- approximate presence returns online only after B reconnects.

## Manual scenario D: interrupted send acknowledgement

1. Interrupt Browser A immediately after emitting a message but before its UI
   receives the acknowledgement.
2. Allow the bounded retry to reuse the same client operation reference.
3. Reload authoritative history.

Expected:

- if the server committed, one message exists and the retry returns it;
- if it did not commit, no accepted/broadcast message exists and the UI offers
  retry;
- no unacknowledged attempt is falsely labeled `Sent`.

## Manual scenario E: block and unblock

1. With both users connected, have A block B while B attempts to send.
2. Open old history from both browsers.
3. Have A unblock B.
4. Suspend B's relevant company membership before another send.

Expected:

- no message ordered after the authoritative block commits;
- both composers are disabled and mutual presence is suppressed;
- pre-block history remains visible with a text blocked label;
- B cannot remove A's directional block;
- unblock alone does not restore messaging after membership authority is lost;
- direct socket calls cannot bypass the same checks.

## Manual scenario F: report

1. From a shared conversation, report the other participant using an allowlisted
   category and optional evidence message reference.
2. Submit the equivalent report again inside 24 hours.
3. Attempt the same operation from a non-participant.

Expected:

- valid and duplicate submissions return the same neutral receipt;
- one pending protected report exists;
- the non-participant receives a neutral denial;
- ordinary Administrator, Candidate, and Recruiter APIs expose no report detail
  or message content;
- audit evidence contains actor/action/target/result/correlation/time but no
  message or report text.

## Manual scenario G: session and multi-tab enforcement

1. Open messaging for A in three tabs.
2. Close one tab and verify A remains approximately online to B.
3. Revoke A's active session or suspend A's account.
4. Attempt join/send from a previously open socket.

Expected:

- one tab closing does not produce false offline state;
- session/account enforcement purges or disconnects affected sockets;
- later direct events are independently denied even if an invalidation signal
  was missed;
- no protected messaging state remains visible after the client authority purge.

## Performance evidence

The focused harness must document:

- environment and server mode;
- dataset of at least 100 conversations for one participant and 10,000 messages;
- number of samples, duration, and concurrency;
- P50, P95, maximum latency, and error rate;
- accepted-message-to-peer-visible latency;
- list and 20-message history usable latency;
- presence/reconnect conditions and any injected failures.

Pass conditions are SC-002 and SC-005 from `spec.md`. Authorization, privacy,
duplicate prevention, and block correctness remain 100% hard gates and are not
percentile-based.

## Release stop conditions

Do not claim Feature 008 complete if any of the following remains:

- a JWT or browser-stored socket credential is introduced;
- the minimal Feature 007 accepted-connection dependency or `canMessage()`
  provider contract is absent;
- application/company context isolation can be bypassed;
- broadcast occurs before durable commit;
- duplicate retries create duplicate messages;
- block/report behavior, reconnect recovery, accessibility, or two-browser tests
  are omitted;
- custom-server production start or existing application regression checks fail;
- any out-of-scope feature appears in an executable interface.

## Implementation validation record — 2026-08-12

All commands below were executed from the repository root on branch
`008-realtime-messaging` with Node.js `24.18.0`. No release-gate result is
inferred from a skipped test.

| Gate | Result | Evidence |
| --- | --- | --- |
| Prisma schema and migration sequence | Pass | `prisma validate` passed; client generation passed; 22 migrations end at `022_realtime_messaging`; migration 022 applied successfully to local PostgreSQL. |
| TypeScript and Feature 008 lint | Pass | `npm run typecheck` passed; ESLint over the custom server, messaging source, scripts, and tests returned zero errors. |
| Focused messaging suites | Pass | `npm run test:messaging`: 27 files and 60 tests passed, including contract, unit, integration, security, architecture, accessibility, and retention checks. |
| Production browser journeys | Pass | `npm run test:messaging:e2e`: ten-run Candidate/Recruiter usability protocol passed; three block/report/session/membership/multi-tab safety journeys passed; two-user realtime, read, offline, reload, and reconnect journey passed. Each spec used a fresh PostgreSQL fixture and production custom server. |
| Performance | Pass | 100 conversations, 10,000 messages, 200 samples, zero errors; list P95 `0.011 ms`, history P95 `0.369 ms`, accepted-to-peer-visible P95 `0.004 ms`. |
| Job-board regression | Pass | `npm run test:job-board`: 37 files and 127 tests passed after aligning the stale CV-import boundary with the existing durable `CandidateCv` projection contract. |
| Admin regression | Pass | `npm run test:admin-management`: 55 files and 152 tests passed on an isolated database migrated from 001 through 022; the temporary database was removed afterward. |
| Production build | Pass | `npm run build` compiled, typechecked, generated 73 static pages, and exposed all messaging REST routes plus `/messages` and `/people/[userId]`. |
| Custom-server start and shutdown | Pass | `npm run smoke:messaging:server` returned health `200`, rejected an unauthenticated `/chat` connection with `AUTH_REQUIRED`, and completed its SIGTERM shutdown handler. |
| Scope absence | Pass | Executable messaging source contains no typing indicator, attachment, group chat, voice/video call, unsend, or message-search capability. |

The JSDOM accessibility runner logs a non-failing canvas-not-implemented notice
from axe color evaluation. It does not produce a serious or critical axe
violation and does not change the passing test result.
