import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("OCR supply-chain gate", () => {
  it("verifies pinned dependencies, model/corpus provenance, vulnerabilities, and browser boundaries", async () => {
    const root = resolve(process.cwd(), "..");
    const { stdout } = await execute(
      process.execPath,
      [resolve(root, "scripts/verify-ocr-supply-chain.mjs")],
      { cwd: root, timeout: 30_000 },
    );
    expect(JSON.parse(stdout)).toMatchObject({ passed: true });
    const report = JSON.parse(
      await readFile(
        resolve(root, "web/.local/evidence/ocr-supply-chain.json"),
        "utf8",
      ),
    );
    expect(report).toMatchObject({
      passed: true,
      model: { license: "Apache-2.0" },
      corpus: { fixtures: 180 },
      dockerBaseImages: {
        "Dockerfile.ocr-engine": [expect.stringContaining("@sha256:")],
        "Dockerfile.image-search-worker": [expect.stringContaining("@sha256:")],
      },
      vulnerabilitySummary: { high: 0, critical: 0 },
      browserBundleForbiddenImports: [],
    });
    expect(report.npm).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "sharp", version: "0.35.3" }),
        expect.objectContaining({ name: "@napi-rs/canvas", version: "1.0.3" }),
      ]),
    );
  });
});
