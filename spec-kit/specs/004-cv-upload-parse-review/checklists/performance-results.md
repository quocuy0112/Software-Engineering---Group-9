# Feature 004 Performance Results

**Recorded:** 2026-08-02  
**Measured local target gate:** **PASS**  
**Production release qualification:** **BLOCKED**

The measured run passed every latency, resource, concurrent-claim, and cleanup
target under the local conditions below. It is engineering evidence for T147;
it is not production release evidence because the run did not use Next
production, the approved external OpenAI synthetic path, private S3/KMS, or an
external-provider network.

## Environment and Isolation

- Node.js `v24.18.0` on Windows 10.0.26200 x64.
- AMD Ryzen 7 8845H, 16 logical CPUs, 29,860,155,392 bytes host memory.
- PostgreSQL `16.12` database `cv_phase8_performance_20260802_01`, created only
  for this run with both `DATABASE_URL` and `DIRECT_URL` overridden; migrations
  001 through 008 were applied from `web/`.
- Next.js development server, real Compose CV worker, real ClamAV Unix socket,
  deterministic internal parser, local encrypted private storage, and loopback
  network.
- UI journeys were serial. Lease claims used 8 concurrent contenders and a
  controlled future lease clock so the wall-clock worker could not consume an
  unobserved fixture.
- One cold journey and nine warm journeys were recorded.

## Dataset and Measurement Window

| Measure                                      |                            Recorded |
| -------------------------------------------- | ----------------------------------: |
| Complete upload/review/save/confirm journeys |                                  10 |
| PDF / DOCX                                   |                               5 / 5 |
| Small / medium / large synthetic text seeds  |                           4 / 3 / 3 |
| Text seed sizes                              | 1,000 / 20,000 / 200,000 characters |
| Largest source document                      |                       201,282 bytes |
| Concurrent claim observations                |                                  20 |
| Cleanup observation units                    |                                 100 |
| Total aggregate-safe observations            |                                 250 |
| Actual wall duration                         |                        88,681.70 ms |
| Controlled cleanup timeline                  |            86,400,000 ms (24 hours) |

The fixed measurement window was
`2026-08-02T04:39:15.781Z` through `2026-08-03T04:39:15.781Z` using the
controlled retention clock. Percentiles use nearest rank: sort ascending and
select `ceil(sample count * percentile)` using one-based indexing. With ten
journey samples, P95 and P99 select the maximum sample.

## Latency Results

| Operation                                 | Samples |   P50 ms |   P95 ms |   P99 ms |   Max ms | Error rate | Target                    | Result |
| ----------------------------------------- | ------: | -------: | -------: | -------: | -------: | ---------: | ------------------------- | ------ |
| Upload finalization / pre-scan feedback   |      10 |   244.22 |   305.41 |   305.41 |   305.41 |         0% | P95 <=5,000 ms            | PASS   |
| Queue to review-ready/actionable terminal |      10 | 2,626.91 | 4,757.50 | 4,757.50 | 4,757.50 |         0% | >=90% <=60 s; all <=180 s | PASS   |
| Scan stage                                |      10 |    82.00 |   117.00 |   117.00 |   117.00 |         0% | Observed                  | PASS   |
| Extraction stage                          |      10 | 1,370.00 | 2,528.00 | 2,528.00 | 2,528.00 |         0% | Observed                  | PASS   |
| Parse stage                               |      10 |    57.00 |    65.00 |    65.00 |    65.00 |         0% | Observed                  | PASS   |
| Review load                               |      10 |   599.60 |   652.76 |   652.76 |   652.76 |         0% | P95 <=3,000 ms            | PASS   |
| Draft save feedback                       |      10 |   268.02 |   419.11 |   419.11 |   419.11 |         0% | P95 <=2,000 ms            | PASS   |
| Confirmation feedback                     |      10 |   261.68 |   271.41 |   271.41 |   271.41 |         0% | P95 <=2,000 ms            | PASS   |

All 10 queue observations completed within 60 seconds (100%), and the maximum
was 4.76 seconds, below the three-minute bound.

## Resource and Claim Results

| Resource metric      | Samples | Maximum bytes | Ceiling bytes | Result |
| -------------------- | ------: | ------------: | ------------: | ------ |
| Source document      |      10 |       201,282 |     5,000,000 | PASS   |
| Extracted UTF-8 text |      10 |       200,054 |       524,288 | PASS   |
| Draft payload        |      10 |           530 |       262,144 | PASS   |
| Provenance payload   |      10 |           275 |       131,072 | PASS   |
| Worker RSS           |      10 |   330,825,728 |   536,870,912 | PASS   |

The 512 MiB RSS ceiling is a predeclared local harness operational ceiling,
not a new product requirement. Worker heap was optional and not observed.

For the 20 concurrent-claim samples, P50/P95/P99/maximum were
8.77/12.99/143.67/143.67 ms. Exactly 20 unique claims succeeded, with zero
duplicate claims and zero contender errors.

## Cleanup Definition and Result

- **Observation unit:** one synthetic cleanup-eligible `CvUpload`, including
  every source/extracted object and every draft/provenance database payload it
  owns.
- **Denominator:** every unit whose eligibility is inside the predeclared window
  and whose maximum deadline is at or before the window end. Overdue failed or
  pending units remain included; later deadlines are censored.
- **Numerator:** denominator units whose required objects are physically absent
  and database payloads scrubbed by the deadline with
  `manualIntervention=NONE`.
- **Deadline treatment:** completion exactly at the deadline passes; completion
  after it or no completion after it fails.
- **Manual intervention:** process restart, operator requeue, database/storage
  mutation, or any other operator action cannot enter the numerator.

The result was 100 numerator units / 100 denominator units = **100%**, with zero
censored, overdue/failed, or manually intervened units. P50/P95/P99/maximum
controlled cleanup turnaround was 86,400,000 ms and deadline overrun was 0 ms.
The controlled clock verifies deadline behavior without claiming a 24-hour
wall-clock endurance run.

## Reproduction

With a unique migrated PostgreSQL database, both database URLs and `TZ=UTC`
overridden, and web/CV-worker processes pointed at that same database:

```powershell
$env:CV_PERF_ITERATIONS = "10"
$env:CV_PERF_CLAIM_SAMPLES = "20"
$env:CV_PERF_CLAIM_CONCURRENCY = "8"
$env:CV_PERF_CLEANUP_UNITS = "100"
$env:CV_PERF_WORKER_RSS_CEILING_BYTES = "536870912"
npm run perf:cv-import:collect --workspace @smarthire/web
npm run perf:cv-import --workspace @smarthire/web -- --input .local/cv-import-performance-input.json
```

The strict input contains only timings, byte counts/ceilings, format/size-bucket
counts, cleanup timestamps/classification, concurrency counts, and safe result
codes. It contains no account/upload IDs, filenames, document text, Profile
values, storage locators, digests, prompts, responses, or provider tokens.

Two setup runs were invalidated before aggregation: one exposed a missing
client-state/hydration wait, and one allowed the wall-clock worker to claim an
unobserved lease fixture. Their observations were not combined with this run.
Exact synthetic setup records/artifacts were removed; the final measured run
reported and independently verified `CV_PERF_FINAL_CLEANUP_COMPLETE`.

## Remaining Release Blocker

Only the ClamAV condition satisfied the production qualification matrix. A
release-qualifying performance run still requires Next production, approved
external OpenAI processing with synthetic data only, private S3/KMS storage,
and the external-provider network. The local dataset also does not exercise a
near-5 MB boundary document. No live-provider, production ingress, S3, or
near-limit performance claim is made by this evidence.
