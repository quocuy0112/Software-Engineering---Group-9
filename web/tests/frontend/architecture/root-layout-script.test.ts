import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("root layout bootstrap script", () => {
  it("uses the Next.js script lifecycle for the pre-hydration theme", async () => {
    const layout = await readFile("src/app/layout.tsx", "utf8");

    expect(layout).toContain('import Script from "next/script"');
    expect(layout).toContain('strategy="beforeInteractive"');
    expect(layout).not.toMatch(/<script\b/u);
  });
});
