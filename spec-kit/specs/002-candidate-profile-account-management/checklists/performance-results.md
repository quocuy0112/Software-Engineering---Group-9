# Profile and account performance results

Recorded on 2026-07-31 with the reproducible
`npm.cmd run perf:profile-account` harness. The command started the optimized
Next.js production bundle with `next start`, selected the capture email adapter,
seeded one disposable maximum-size account, measured one unrecorded warm-up plus
100 recorded samples per class, and removed the live account after the run.

## Environment and dataset

| Property                 | Recorded value                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| Host                     | Windows 10.0.26200 x64                                             |
| CPU / logical processors | AMD Ryzen 7 8845H / 16                                             |
| Memory                   | 27.81 GiB                                                          |
| Runtime                  | Node.js 24.18.0                                                    |
| Application              | Next.js 16.2.11 production `next start`                            |
| Authentication           | Better Auth 1.6.25                                                 |
| Browser                  | Chromium 143.0.7499.4, headless, 1280x720                          |
| Database                 | PostgreSQL 16.12, local Compose service                            |
| Email                    | Capture adapter; asynchronous provider delivery excluded           |
| Motion                   | Reduced motion enabled                                             |
| Profile                  | 50 skills, 50 experiences, 50 education entries, 10 social links   |
| Sessions                 | Five active opaque Better Auth sessions                            |
| Catalog                  | 50 run-specific normalized skills plus the existing shared catalog |
| Sampling                 | One unrecorded warm-up and 100 recorded warm samples per class     |

The harness asserted the profile and session counts before measurement. The
PostgreSQL warm round-trip baseline over 100 samples was p50 1.37 ms, p95
1.86 ms, and maximum 2.18 ms.

## View-load results

Elapsed time starts immediately before authenticated navigation and ends when
the completed accessible view is visible. The maximum Profile view additionally
waits for skill 50, experience 50, education 50, and social link 10 to render.

| View class           | Samples |       p50 |       p95 |   Maximum |   Budget | Result |
| -------------------- | ------: | --------: | --------: | --------: | -------: | ------ |
| Professional Profile |     100 | 814.82 ms | 869.11 ms | 909.04 ms | 3,000 ms | PASS   |
| Account identity     |     100 | 103.27 ms | 402.81 ms | 451.76 ms | 3,000 ms | PASS   |
| Account preferences  |     100 |  93.65 ms | 116.13 ms | 144.99 ms | 3,000 ms | PASS   |
| Account security     |     100 | 119.32 ms | 152.50 ms | 223.49 ms | 3,000 ms | PASS   |

## Mutation results

Elapsed time starts at a valid UI submission and ends only after a successful
authoritative response, the accessible visible result, and the reconciled
enabled form state. Profile saves run while the full maximum aggregate exists.

| Mutation class          | Samples |       p50 |       p95 |   Maximum |   Budget | Result |
| ----------------------- | ------: | --------: | --------: | --------: | -------: | ------ |
| Profile basics save     |     100 | 256.47 ms | 461.51 ms | 578.94 ms | 2,000 ms | PASS   |
| Account identity save   |     100 | 101.96 ms | 224.81 ms | 322.39 ms | 2,000 ms | PASS   |
| Account preference save |     100 | 114.76 ms | 300.93 ms | 331.61 ms | 2,000 ms | PASS   |

## Password-change session revocation

Immediately before password change, the harness re-asserted five active
sessions. Wall-clock measurements began only after the successful password
change response had completed.

| Other session | Rejection elapsed |
| ------------- | ----------------: |
| 1             |          33.31 ms |
| 2             |          34.87 ms |
| 3             |          34.83 ms |
| 4             |          35.32 ms |

All four other sessions returned `401` within the 2,000 ms budget. The
initiating session returned `200`, and the database contained exactly one
active session afterward. External email delivery time was not included;
password-change success includes the durable outbox enqueue.

Overall result: **PASS** for SC-001, SC-002, and the timing portion of SC-006.
