import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application font delivery", () => {
  it("self-hosts the pinned Be Vietnam Pro font without Google Font requests", async () => {
    const [layout, manifestSource] = await Promise.all([
      readFile("src/app/layout.tsx", "utf8"),
      readFile("package.json", "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource) as {
      dependencies?: Record<string, string>;
    };

    expect(layout).toContain("@fontsource/be-vietnam-pro/400.css");
    expect(layout).toContain("@fontsource/be-vietnam-pro/700.css");
    expect(layout).not.toMatch(/next\/font\/google|fonts\.googleapis\.com/);
    expect(manifest.dependencies?.["@fontsource/be-vietnam-pro"]).toBe("5.3.0");
  });
});
