import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OCR/image-worker failure isolation", () => {
  it("builds workers sequentially and starts one dependency-aware Compose group", async () => {
    const script = await readFile(
      resolve(process.cwd(), "../scripts/run-local-development.mjs"),
      "utf8",
    );
    expect(script).toMatch(
      /"building CV worker image"[\s\S]+?"build",\s*"cv-worker"/u,
    );
    expect(script).toMatch(
      /"building OCR and image-search worker images"[\s\S]+?"build",\s*"ocr-engine",\s*"image-search-worker"/u,
    );
    expect(script.indexOf("if (shutdownPromise) return")).toBeLessThan(
      script.indexOf('"building OCR and image-search worker images"'),
    );
    expect(script).toContain(
      'const composeServices = ["postgres", "clamav", "cv-worker"]',
    );
    expect(script).toContain(
      'composeServices.push("ocr-engine", "image-search-worker")',
    );
    expect(script).toContain(
      '"up",\n    "--no-build",\n    ...composeServices',
    );
    expect(script).not.toContain('"--no-deps"');
    expect(script).toContain('stdio: "inherit"');
    expect(script).toContain('child.once("error", (error) =>');
    expect(script).toContain('child.once("exit", (code, signal) =>');
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
