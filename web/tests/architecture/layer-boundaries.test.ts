import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? files(path) : Promise.resolve([path]);
      }),
    )
  ).flat();
}

describe("application layers", () => {
  it("does not implement Pages Router APIs", async () => {
    await expect(readdir("src/pages/api")).rejects.toThrow();
  });
  it("keeps health transport free of providers", async () => {
    const source = await readFile("src/app/api/health/route.ts", "utf8");
    expect(source).not.toMatch(/@prisma\/client|resend/);
  });
  it("keeps App Router modules free of direct data providers", async () => {
    for (const path of await files("src/app")) {
      if (![".ts", ".tsx"].includes(extname(path))) continue;
      expect(await readFile(path, "utf8")).not.toMatch(
        /@prisma\/client|from ["']resend["']|@\/backend\/(?:database|repositories|generated)\//,
      );
    }
  });

  it("keeps client state and effects in frontend features", async () => {
    for (const path of await files("src/app")) {
      if (![".ts", ".tsx"].includes(extname(path))) continue;
      expect(await readFile(path, "utf8")).not.toMatch(
        /["']use client["']|useState\(|useEffect\(/,
      );
    }
  });

  it("keeps generated Prisma code inside the backend boundary", async () => {
    await expect(readdir("src/shared/generated")).rejects.toThrow();
    expect(await readdir("src/backend/generated/prisma")).toContain(
      "client.ts",
    );
  });

  it("keeps the global stylesheet as an ordered import manifest", async () => {
    const stylesheet = await readFile("src/app/globals.css", "utf8");
    const lines = stylesheet.split(/\r?\n/).filter(Boolean);

    expect(lines).toEqual([
      '@import "tailwindcss";',
      '@import "../frontend/styles/tokens.css";',
      '@import "../frontend/styles/base.css";',
      '@import "../frontend/styles/auth.css";',
      '@import "../frontend/styles/home.css";',
      '@import "../frontend/styles/workspace.css";',
      '@import "../frontend/styles/profile.css";',
    ]);
  });
});
