import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application font delivery", () => {
  it("self-hosts the pinned Inter variable font without Google Font requests", async () => {
    const [layout, manifestSource] = await Promise.all([
      readFile("src/app/layout.tsx", "utf8"),
      readFile("package.json", "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource) as {
      dependencies?: Record<string, string>;
    };

    expect(layout).toContain('@fontsource-variable/inter/wght.css');
    expect(layout).not.toMatch(/next\/font\/google|fonts\.googleapis\.com/);
    expect(manifest.dependencies?.["@fontsource-variable/inter"]).toBe(
      "5.3.0",
    );
  });
});
