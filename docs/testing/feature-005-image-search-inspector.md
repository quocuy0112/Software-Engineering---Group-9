# Feature 005 Image-search OCR/AI Inspector

This development-only CLI separates OCR output from AI interpretation so a
developer can determine whether a poor image-search proposal originated in
recognition, interpretation, or the deterministic selection policy.

Use only synthetic or explicitly redistributable test images. The inspector
can print recognized text and proposal values to the terminal, so it must not
be used with real personal or production material. It is disabled when
`NODE_ENV=production`.

## Start the private dependencies

From the repository root:

```powershell
docker compose up -d postgres clamav ocr-engine
docker compose build image-search-worker
```

Wait until ClamAV and the OCR engine are healthy. The inspector deliberately
uses their private Unix sockets and therefore runs inside a one-off
`image-search-worker` container.

Place test inputs in a local directory such as `web/.local/ocr-inspection`.
That directory is gitignored. Then run OCR only:

```powershell
docker compose run --rm --no-deps `
  -v "${PWD}/web/.local/ocr-inspection:/inspect:ro" `
  image-search-worker `
  node --conditions=react-server --import tsx `
  scripts/inspect-image-search.mjs `
  --image /inspect/poster.png `
  --show-content
```

To compare OCR with the production OpenAI interpreter and local selection
policy, add `--with-ai`:

```powershell
docker compose run --rm --no-deps `
  -v "${PWD}/web/.local/ocr-inspection:/inspect:ro" `
  image-search-worker `
  node --conditions=react-server --import tsx `
  scripts/inspect-image-search.mjs `
  --image /inspect/poster.png `
  --show-content `
  --with-ai
```

This requires the existing server-only `OPENAI_API_KEY` in the Compose env
files. The image is never sent to OpenAI; only recognized text is sent.

## Measure real word accuracy

Create `/inspect/poster-truth.txt` containing the exact UTF-8 text expected in
the image, in reading order, and run:

```powershell
docker compose run --rm --no-deps `
  -v "${PWD}/web/.local/ocr-inspection:/inspect:ro" `
  image-search-worker `
  node --conditions=react-server --import tsx `
  scripts/inspect-image-search.mjs `
  --image /inspect/poster.png `
  --truth /inspect/poster-truth.txt `
  --show-content `
  --with-ai
```

The report distinguishes:

- `ocr.summary.averageConfidencePercent`: model confidence, not accuracy;
- `ocr.wordAccuracy.accuracyPercent`: measured word accuracy against truth;
- `ai.rawProposals`: provider output before local validation;
- `ai.validatedIntent`: final proposals after evidence, type, confidence, and
  contradiction checks.

Interpret the result as follows:

- Incorrect/missing `ocr.text` means recognition or preprocessing needs work.
- Correct OCR plus incorrect `rawProposals` means the AI prompt/model needs
  work.
- Correct raw proposals but missing/incorrect validated proposals means the
  local selection policy or contract needs work.
- Correct validated intent but incorrect `/jobs` results means the problem is
  downstream in Feature 003 criteria application or deterministic search.

Run the scoring-helper smoke test without Docker dependencies:

```powershell
cd web
npm.cmd run image-search:inspect -- --self-test
```
