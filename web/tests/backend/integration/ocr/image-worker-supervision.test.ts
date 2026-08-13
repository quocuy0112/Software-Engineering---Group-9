import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OCR/image-worker failure isolation", () => {
  it("starts web without waiting for scanner-dependent workers", async () => {
    const script = await readFile(
      resolve(process.cwd(), "../scripts/run-local-development.mjs"),
      "utf8",
    );
    expect(script).toContain('"building worker images"');
    for (const service of [
      "cv-worker",
      "ocr-engine",
      "image-search-worker",
      "admin-worker",
    ]) {
      expect(script).toContain(`"${service}"`);
    }
    expect(script).toContain('"postgres"');
    expect(script).toContain('"clamav"');
    expect(script).toContain(
      '["compose", "up", "-d", "--no-build", ...infrastructureServices]',
    );
    expect(script).toContain(
      '["compose", "up", "-d", "--no-build", "--no-deps", ...workerServices]',
    );
    expect(script).not.toContain('"compose",\n        "stop"');
    expect(script).toContain('stdio: "inherit"');
    expect(script).toContain('child.once("error", (error) =>');
    expect(script).toContain('child.once("exit", (code, signal) =>');
    expect(script).toContain(
      "Compose infrastructure and workers remain running",
    );
    expect(
      script.indexOf(
        'void runCommand(\n    "starting restartable worker services',
      ),
    ).toBeLessThan(script.indexOf('start("web", "dev:web")'));
    expect(script).toContain("web startup does not wait for ClamAV health");
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

  it("gives every long-running Compose service a restart policy", async () => {
    const compose = await readFile(
      resolve(process.cwd(), "../compose.yaml"),
      "utf8",
    );
    for (const service of [
      "postgres",
      "clamav",
      "cv-worker",
      "ocr-engine",
      "image-search-worker",
      "admin-worker",
    ]) {
      const start = compose.indexOf(`  ${service}:`);
      const remainder = compose.slice(start + `  ${service}:`.length);
      const nextService = remainder.match(/\r?\n {2}[a-z][a-z0-9-]*:/u);
      const end =
        nextService?.index === undefined
          ? undefined
          : start + `  ${service}:`.length + nextService.index;
      const definition = compose.slice(start, end);
      expect(definition).toContain("restart: unless-stopped");
    }
  });

  it("keeps host-only storage paths out of the Linux admin worker", async () => {
    const compose = await readFile(
      resolve(process.cwd(), "../compose.yaml"),
      "utf8",
    );
    const adminWorker = compose.slice(compose.indexOf("  admin-worker:"));
    expect(adminWorker).toContain(
      "CV_STORAGE_LOCAL_ROOT: /app/.local/cv-storage",
    );
    expect(adminWorker).toContain(
      "IMAGE_SEARCH_STORAGE_LOCAL_ROOT: /app/.local/image-search-storage",
    );
  });
});
