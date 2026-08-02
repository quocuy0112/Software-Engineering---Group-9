# Feature 004 Dependency and Infrastructure Gate

**Gate date**: 2026-08-01  
**Status**: PASS  
**Waivers**: None

## Reviewed dependency set

| Package              | Exact version | Reviewed license | Result |
| -------------------- | ------------: | ---------------- | ------ |
| `@aws-sdk/client-s3` |      3.1101.0 | Apache-2.0       | PASS   |
| `pdfjs-dist`         |       6.2.108 | Apache-2.0       | PASS   |
| `mammoth`            |        1.12.0 | BSD-2-Clause     | PASS   |
| `yauzl`              |         3.4.0 | MIT              | PASS   |
| `fast-xml-parser`    |        5.10.1 | MIT              | PASS   |
| `openai`             |         7.3.0 | Apache-2.0       | PASS   |
| `@types/yauzl`       |         3.4.0 | MIT              | PASS   |

- Node: `24.18.0` — PASS.
- npm: `11.16.0` for the repository workflow — PASS.
- Lockfiles: exactly one root `package-lock.json` — PASS.
- `npm audit --json --package-lock-only`: `0 critical`, `0 high`, `0 total` — PASS.
- Parser contract `contracts/cv-parser-output.schema.json`: JSON Schema 2020-12 loaded with closed top-level properties and `cv-draft-v1` — PASS.
- Reviewed parser/storage packages are absent from App Router, frontend, and shared browser boundaries — PASS.

## Container and transport evidence

| Check              | Safe result                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| ClamAV image       | `clamav/clamav:1.4_base@sha256:35ec19c1e8cbee7cae8a35c3b0ac62957d99b418e6902035b89a1778c39433e7`                     |
| ClamAV engine      | `1.4.5`                                                                                                              |
| Worker base        | `node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436`                    |
| Worker image       | `smarthire-cv-worker:local`, digest `sha256:c977feda8021550b971e91fd30d0b001105120173a6de8d57a6d8ea9a1a276c9`, 58 MB |
| Scanner socket     | `/run/clamav/clamd.sock`, socket mode/owner/group `0660:100:101`                                                     |
| Scanner networking | no `TCPSocket`/`TCPAddr`, no live 3310/7357 listener, no published port                                              |
| Scanner resources  | 4 GiB memory ceiling; 6 MiB stream/file/scan caps                                                                    |
| Worker boundaries  | `postgres:5432`, `/app/.local/cv-storage`, socket group `101`; probe PASS                                            |
| Mount scope        | runtime socket shared only by `clamav` and `cv-worker`; no web/email mount                                           |
| ClamAV Scout scan  | 53 packages, `0 critical`, `0 high`                                                                                  |
| Worker Scout scan  | 25 packages, `0 critical`, `0 high`                                                                                  |

The first full worker-image scan correctly failed on unreviewed findings inherited from build/dev tooling, npm CLI, and the Debian base. No waiver was issued. The runtime scaffold was reduced to its current permitted probe scope, switched to the immutable Alpine base, stripped package-manager/build tooling, rebuilt without cache, probed again, and rescanned cleanly. Runtime application dependencies remain exact in the sole lockfile and will require a fresh image scan when worker orchestration is added.

## Reproduction commands

```powershell
npm.cmd ls @aws-sdk/client-s3 pdfjs-dist mammoth yauzl fast-xml-parser openai @types/yauzl --all
npm.cmd audit --json --package-lock-only
docker compose config --quiet
docker compose build --no-cache cv-worker
docker compose up -d postgres clamav
docker compose run --rm cv-worker
docker compose exec -T clamav clamd --version
docker compose exec -T clamav stat -c '%a:%u:%g:%F' /run/clamav/clamd.sock
docker port smarthire-clamav-1
docker scout cves --only-severity critical,high --exit-code clamav/clamav:1.4_base@sha256:35ec19c1e8cbee7cae8a35c3b0ac62957d99b418e6902035b89a1778c39433e7
docker scout cves --only-severity critical,high --exit-code smarthire-cv-worker:local
Set-Location web
npm.cmd exec vitest -- run tests/backend/compatibility/cv-import/dependency-and-infrastructure.test.ts
```

The test and commands emit only versions, digests, byte sizes, safe topology, exit state, and aggregate vulnerability counts. They do not print environment values, credentials, CV content, filenames, object keys, or user identifiers.
