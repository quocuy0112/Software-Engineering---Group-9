# Quickstart: Candidate Application Tracking and Private CV Match

## Prerequisites

- Node.js `24.18.x`, npm `11.16.x`, Docker, and initialized local environment
- PostgreSQL, CV worker dependencies, and a private file-storage test adapter
- Candidate, recruiter/company, published-job, parsed-CV, and stage-transition fixtures
- Successful, timeout, and malformed-response fake AI adapters

## Apply and Verify Data Changes

```powershell
npm run db:up
npm run db:validate
npm run db:generate --workspace @smarthire/web
npm run db:migrations:reconcile-names --
npm run db:deploy
npm run db:migrations:check
```

Run the feature migration verifier and confirm:

- existing candidate-job Application uniqueness and stages are unchanged;
- withdrawal outcome is not an `ApplicationStage`;
- drafts, intake, public updates, and preferences have required unique/index constraints;
- private tables contain no Application, company, recruiter, or employer-result relationship;
- current private attempts belong to their checks;
- expiry/deletion deadlines and work indexes are valid.

## Run Focused Validation

```powershell
npm run test:candidate-application-private-match --workspace @smarthire/web
npm run typecheck
npm run lint
npm run db:verify
npm run build
```

The focused command should cover contracts, policies, repository integration, workers, UI, accessibility, architecture, security, retention, and performance.

## Scenario 1: Draft review and idempotent submission

1. Sign in as a Candidate, select a published job and parsed owned CV, complete personal information/files, and save.
2. Reopen the draft and verify the same candidate-job draft/revision is restored.
3. Review the exact files, transparency block, and confirmation requirement.
4. Submit twice with the same idempotency context and simulate an ambiguous first response.
5. Verify one `JobApplication`, immutable CV/JD/profile/message snapshots, one initial event/intake/preferences set, and no private or recruiter score in the response.
6. Advance time beyond 30 days on another unsubmitted draft and verify it is unavailable and created no Application/scoring work.

## Scenario 2: Intake and safe tracking

1. Hold the intake worker after receipt and inspect percentage/three-step timestamps.
2. Leave and reopen; verify progress persists and does not regress on duplicate/out-of-order completion.
3. Complete intake and transition the Application through representative canonical stages.
4. Verify the four-stage public projection and timeline, immutable submitted files, five-second in-app freshness, and structural absence of score/rank/internal note/reason.
5. Fail AI/scoring and verify receipt, intake, tracking, files, and withdrawal eligibility remain usable.

## Scenario 3: Withdrawal race

1. Withdraw an `APPLIED` Application with expected version and confirmation.
2. Verify its canonical stage is preserved, terminal withdrawal fields/public Outcome are set once, active work stops, and one audit/update/recruiter notification intent exists.
3. Replay the command and verify idempotent outcome.
4. Race withdrawal against transition to `INTERVIEWING`; exactly one valid command commits and post-interview withdrawal is rejected without data leakage.

## Scenario 4: Normal private match

1. Choose one parsed CV and visible job and start analysis.
2. Use fixture scores Automatic 92 and AI 88.
3. Verify one private check, fixed CV/JD/config provenance, completed steps, full evidence/gaps/guidance, and hybrid `89.6` from one-time rounding.
4. Verify High Match, 40/60 contributions, evidence coverage/confidence as non-core signals, and sensitive-attribute exclusion.
5. Search recruiter/company/admin APIs and repositories for the check ID and verify indistinguishable unavailable responses and no employer score mutation.

## Scenario 5: Limited mode and AI retry

1. Make deterministic matching succeed and AI time out/malformed-output fail.
2. Verify deterministic score/evidence render fully, AI is `—`, and hybrid/band are absent.
3. Start Retry AI and verify the prior limited attempt remains current/readable and Apply now remains usable.
4. Complete retry successfully; verify the same check promotes the new hybrid attempt and retains immutable attempt outcomes/timestamps.
5. Verify the Application review prefill carries only job/CV IDs and independently revalidates/snapshots them.

## Scenario 6: Retention and deletion

1. Delete an owned private check while an AI retry is leased.
2. Verify access ends immediately, lease completion cannot republish/recreate it, and Application/employer data is unchanged.
3. Advance a different check to 12 months and verify identical logical denial.
4. Run cleanup before and at the 30-day deadline; verify bounded retry, physical derived-data deletion, and content-free operator failure reporting.

## Scenario 7: Per-application notifications

1. Create two Applications for different jobs.
2. Disable email only on the first and in-app only on the second.
3. Trigger public stage changes and verify each Application's preferences independently control optional delivery.
4. Verify both tracker timelines update and mandatory communications are unaffected.

## Security and Architecture Checks

- Candidate A cannot infer Candidate B's draft, Application, preference, file, check, result, attempt, or deletion state.
- Recruiter/company/admin scopes cannot enumerate private checks even when they know Candidate, CV, or job identifiers.
- Candidate contracts contain no employer score/status, rank, internal note/reason, private criteria, or other applicant data.
- Architecture tests reject imports from private-match repositories/services into recruiter ranking or employer evaluation modules.
- Logs/audits contain correlation IDs and safe codes, not CV quotes, report evidence, messages, raw AI output, or sensitive attributes.

## Performance Check

```powershell
npm run perf:candidate-application-private-match --workspace @smarthire/web
```

Record environment, dataset, warm-up, sample size, concurrency, provider conditions, P50/P95/P99/max, and error rate. Required P95 outcomes:

- Candidate page usable ≤3 seconds;
- feature navigation and mutation acknowledgement ≤2 seconds;
- public in-app update visibility ≤5 seconds;
- normal private AI completion ≤20 seconds asynchronously;
- no cross-owner disclosure, duplicate Application, score divergence, or lost deterministic fallback in any tested case.

## Usability and Comprehension Check

Run a moderated, consented usability study with a documented representative Candidate cohort, fixed valid-input fixtures, and no production personal data.

1. Ask each participant to review and submit one prepared application without facilitator intervention. Record first-attempt completion and elapsed time; at least 95% must complete within three minutes.
2. Ask each participant to inspect a normal or limited Private CV Match report, then answer whether it is hiring guidance, whether recruiters can see it, and whether it affects real application ranking. At least 90% must answer all three correctly.
3. Record cohort definition, sample size, environment, scenario script, accessibility accommodations, completion counts, timing method, comprehension questions, aggregate results, and observed blockers.
4. Store only aggregate evidence in the feature validation record; do not retain participant CV content or unnecessary personal data.

## Rollback

Disable new draft/private-check entry points and stop their workers. Keep existing Application reads/submission compatibility, additive tables, withdrawal history, public updates, and audit/outbox records. Do not drop tables or restore logically deleted private content during emergency rollback; use a forward corrective migration.
