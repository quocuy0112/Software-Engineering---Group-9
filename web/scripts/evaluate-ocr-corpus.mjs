import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_MANIFEST = resolve(
  process.cwd(),
  "tests/fixtures/ocr-corpus/manifest.json",
);

function words(value) {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("vi")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let column = 1; column <= right.length; column++)
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[right.length];
}

function assertFloor(actual, required, label) {
  if (actual < required)
    throw new Error(`${label}: ${actual} is below ${required}`);
}

function cohort(fixtures, predicate) {
  const selected = fixtures.filter(predicate);
  return {
    fixtures: selected.length,
    words: selected.reduce((sum, fixture) => sum + fixture.wordCount, 0),
  };
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export async function verifyCorpusManifest(manifestPath = DEFAULT_MANIFEST) {
  const absoluteManifest = resolve(manifestPath);
  const root = resolve(absoluteManifest, "..");
  const manifest = JSON.parse(await readFile(absoluteManifest, "utf8"));
  if (manifest.schemaVersion !== "smarthire-ocr-corpus-v1")
    throw new Error("Unsupported corpus schema");
  const fixtures = manifest.fixtures;
  if (!Array.isArray(fixtures)) throw new Error("Corpus fixtures are required");
  const ids = new Set();
  let labeledWords = 0;
  for (const fixture of fixtures) {
    if (ids.has(fixture.id)) throw new Error(`Duplicate fixture ${fixture.id}`);
    ids.add(fixture.id);
    if (
      !manifest.contentPolicy.allowedSourceClasses.includes(fixture.sourceClass)
    )
      throw new Error(`Disallowed provenance for ${fixture.id}`);
    if (fixture.sourceClass === "SYNTHETIC" && fixture.license !== "CC0-1.0")
      throw new Error(`Synthetic license mismatch for ${fixture.id}`);
    const assetPath = resolve(root, fixture.assetPath);
    if (!assetPath.startsWith(`${root}\\`) && !assetPath.startsWith(`${root}/`))
      throw new Error(`Asset path escapes corpus for ${fixture.id}`);
    if ((await sha256(assetPath)) !== fixture.assetSha256)
      throw new Error(`Asset checksum mismatch for ${fixture.id}`);
    const truth = await readFile(resolve(root, fixture.truthPath), "utf8");
    const actualWords = words(truth).length;
    if (actualWords !== fixture.wordCount)
      throw new Error(`Truth word count mismatch for ${fixture.id}`);
    labeledWords += actualWords;
  }
  assertFloor(ids.size, manifest.minimums.uniqueFixtures, "unique fixtures");
  assertFloor(labeledWords, manifest.minimums.labeledWords, "labeled words");
  const cohorts = {
    VIETNAMESE: cohort(fixtures, (item) => item.language === "VIETNAMESE"),
    ENGLISH: cohort(fixtures, (item) => item.language === "ENGLISH"),
    BILINGUAL: cohort(fixtures, (item) => item.language === "BILINGUAL"),
    LAYOUT: cohort(fixtures, (item) => item.layouts.length > 0),
    QUALITY: cohort(fixtures, (item) => item.qualities.length > 0),
    SECURITY: cohort(fixtures, (item) => item.security.length > 0),
    CV: cohort(fixtures, (item) => item.purpose === "CV"),
    JOB_POSTER: cohort(fixtures, (item) => item.purpose === "JOB_POSTER"),
  };
  for (const [name, minimum] of Object.entries(manifest.minimums.cohorts)) {
    assertFloor(cohorts[name].fixtures, minimum.fixtures, `${name} fixtures`);
    assertFloor(cohorts[name].words, minimum.words, `${name} words`);
  }
  for (const [name, minimum] of Object.entries(manifest.minimums.layoutEach))
    assertFloor(
      fixtures.filter((item) => item.layouts.includes(name)).length,
      minimum,
      `${name} fixtures`,
    );
  for (const [name, minimum] of Object.entries(manifest.minimums.qualityEach))
    assertFloor(
      fixtures.filter((item) => item.qualities.includes(name)).length,
      minimum,
      `${name} fixtures`,
    );
  for (const [name, minimum] of Object.entries(manifest.minimums.securityEach))
    assertFloor(
      fixtures.filter((item) => item.security.includes(name)).length,
      minimum,
      `${name} fixtures`,
    );
  for (const [name, minimum] of Object.entries(
    manifest.minimums.posterLanguageEach,
  ))
    assertFloor(
      fixtures.filter(
        (item) => item.purpose === "JOB_POSTER" && item.language === name,
      ).length,
      minimum,
      `poster ${name} fixtures`,
    );
  return {
    manifest,
    root,
    summary: { uniqueFixtures: ids.size, labeledWords, cohorts },
  };
}

export async function evaluateCorpusResults(manifestPath, resultsPath) {
  const verified = await verifyCorpusManifest(manifestPath);
  const results = JSON.parse(await readFile(resolve(resultsPath), "utf8"));
  if (
    results.schemaVersion !== "smarthire-ocr-corpus-results-v1" ||
    !Array.isArray(results.results)
  )
    throw new Error("Unsupported corpus results schema");
  const byId = new Map(results.results.map((result) => [result.id, result]));
  const scored = [];
  let correctIntent = 0;
  let totalIntent = 0;
  let securityCorrect = 0;
  let securityTotal = 0;
  let zeroTextRejections = 0;
  for (const fixture of verified.manifest.fixtures) {
    const result = byId.get(fixture.id);
    if (!result) throw new Error(`Missing result for ${fixture.id}`);
    if (fixture.security.length) {
      securityTotal++;
      if (result.disposition === fixture.expectedDisposition) securityCorrect++;
    }
    if (fixture.wordCount === 0) {
      if (result.disposition === fixture.expectedDisposition)
        zeroTextRejections++;
    } else {
      const truthTokens = words(
        await readFile(resolve(verified.root, fixture.truthPath), "utf8"),
      );
      const actualTokens = words(String(result.recognizedText ?? ""));
      const errors = editDistance(truthTokens, actualTokens);
      scored.push({
        language: fixture.language,
        truthWords: truthTokens.length,
        correctWords: Math.max(0, truthTokens.length - errors),
      });
    }
    const fixtureIntent = fixture.intentLabels.filter(
      (label) => label.supported,
    ).length;
    totalIntent += fixtureIntent;
    correctIntent += Math.min(
      fixtureIntent,
      Number(result.correctIntentLabels ?? 0),
    );
  }
  const accuracy = (items) => {
    const total = items.reduce((sum, item) => sum + item.truthWords, 0);
    return total
      ? items.reduce((sum, item) => sum + item.correctWords, 0) / total
      : 0;
  };
  const overall = accuracy(scored);
  const language = Object.fromEntries(
    ["VIETNAMESE", "ENGLISH", "BILINGUAL"].map((name) => [
      name,
      accuracy(scored.filter((item) => item.language === name)),
    ]),
  );
  assertFloor(overall, 0.95, "overall OCR accuracy");
  for (const [name, value] of Object.entries(language))
    assertFloor(value, 0.9, `${name} OCR accuracy`);
  assertFloor(
    totalIntent ? correctIntent / totalIntent : 0,
    0.9,
    "supported intent accuracy",
  );
  assertFloor(
    securityTotal ? securityCorrect / securityTotal : 0,
    1,
    "security disposition recall",
  );
  return {
    ...verified.summary,
    accuracy: { overall, language },
    intentAccuracy: correctIntent / totalIntent,
    securityRecall: securityCorrect / securityTotal,
    zeroTextRejections,
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestPath = argument("--manifest") ?? DEFAULT_MANIFEST;
  const resultsPath = argument("--results");
  const report = resultsPath
    ? await evaluateCorpusResults(manifestPath, resultsPath)
    : (await verifyCorpusManifest(manifestPath)).summary;
  console.log(
    JSON.stringify(
      {
        schemaVersion: "smarthire-ocr-corpus-evaluation-v1",
        mode: resultsPath
          ? "RELEASE_ACCURACY"
          : "MANIFEST_ONLY_NO_ACCURACY_CLAIM",
        ...report,
      },
      null,
      2,
    ),
  );
}
