import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OCR/image-worker failure isolation", () => {
  it("keeps core development processes fatal while OCR workers are optional", async () => {
    const script = await readFile(
      resolve(process.cwd(), "../scripts/run-local-development.mjs"),
      "utf8",
    );
    expect(script).toContain('"postgres",\n  "clamav",\n  "cv-worker"');
    expect(script).toMatch(
      /"OCR and image-search workers"[\s\S]+?"ocr-engine", "image-search-worker"[\s\S]+?false/u,
    );
    expect(script).toContain(
      "continuing with reduced OCR/image-search capability",
    );
  });

  it("does not make the native CV worker depend on OCR startup", async () => {
    const compose = await readFile(
      resolve(process.cwd(), "../compose.yaml"),
      "utf8",
    );
    const cvWorker = compose.slice(
      compose.indexOf("  cv-worker:"),
      compose.indexOf("  ocr-engine:"),
    );
    expect(cvWorker).toContain("clamav:");
    expect(cvWorker).not.toContain("ocr-engine:");
  });
});
