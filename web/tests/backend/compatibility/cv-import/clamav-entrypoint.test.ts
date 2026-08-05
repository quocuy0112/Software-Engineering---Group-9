import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ClamAV startup entrypoint", () => {
  it("updates signatures before starting clamd", async () => {
    const repositoryRoot = resolve(process.cwd(), "..");
    const source = await readFile(
      resolve(repositoryRoot, "infra/clamav/entrypoint.sh"),
      "utf8",
    );
    const foregroundUpdate = source.indexOf("freshclam --stdout --user=clamav");
    const daemonUpdate = source.indexOf("freshclam", foregroundUpdate + 1);
    const clamdStart = source.indexOf("clamd --foreground");

    expect(foregroundUpdate).toBeGreaterThanOrEqual(0);
    expect(daemonUpdate).toBeGreaterThan(foregroundUpdate);
    expect(clamdStart).toBeGreaterThan(foregroundUpdate);
  });
});
