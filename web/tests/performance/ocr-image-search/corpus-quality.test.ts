import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const manifestPath = resolve(
  process.cwd(),
  "tests/fixtures/ocr-corpus/manifest.json",
);
const evaluatorPath = resolve(process.cwd(), "scripts/evaluate-ocr-corpus.mjs");
const resultPath = resolve(
  tmpdir(),
  `smarthire-ocr-results-${process.pid}.json`,
);

afterEach(() => rm(resultPath, { force: true }));

describe("Feature 005 corpus quality gates", () => {
  it("enforces every fixture, word, cohort, distribution, hash, and provenance floor", async () => {
    const { stdout } = await execute(process.execPath, [
      evaluatorPath,
      "--manifest",
      manifestPath,
    ]);
    const report = JSON.parse(stdout);
    expect(report).toMatchObject({
      mode: "MANIFEST_ONLY_NO_ACCURACY_CLAIM",
      uniqueFixtures: 180,
      labeledWords: 19_200,
    });
    for (const language of ["VIETNAMESE", "ENGLISH", "BILINGUAL"])
      expect(report.cohorts[language]).toMatchObject({ fixtures: 60 });
    expect(report.cohorts.SECURITY).toMatchObject({
      fixtures: 30,
      words: 1_200,
    });
  });

  it("accepts complete perfect synthetic evidence and rejects trivially incomplete evidence", async () => {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const results = [];
    for (const fixture of manifest.fixtures) {
      results.push({
        id: fixture.id,
        disposition: fixture.expectedDisposition,
        recognizedText: await readFile(
          resolve(manifestPath, "..", fixture.truthPath),
          "utf8",
        ),
        correctIntentLabels: fixture.intentLabels.filter(
          (label: { supported: boolean }) => label.supported,
        ).length,
      });
    }
    await writeFile(
      resultPath,
      JSON.stringify({
        schemaVersion: "smarthire-ocr-corpus-results-v1",
        results,
      }),
    );
    const { stdout } = await execute(process.execPath, [
      evaluatorPath,
      "--manifest",
      manifestPath,
      "--results",
      resultPath,
    ]);
    expect(JSON.parse(stdout)).toMatchObject({
      mode: "RELEASE_ACCURACY",
      accuracy: { overall: 1 },
      intentAccuracy: 1,
      securityRecall: 1,
    });

    await writeFile(
      resultPath,
      JSON.stringify({
        schemaVersion: "smarthire-ocr-corpus-results-v1",
        results: results.slice(0, 1),
      }),
    );
    await expect(
      execute(process.execPath, [
        evaluatorPath,
        "--manifest",
        manifestPath,
        "--results",
        resultPath,
      ]),
    ).rejects.toThrow(/Missing result/u);
  });
});
