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
    ]);

    const routeStyles = [
      ["src/app/(auth)/layout.tsx", "frontend/styles/auth.css"],
      ["src/app/page.tsx", "frontend/styles/home.css"],
      ["src/app/(workspace)/layout.tsx", "frontend/styles/workspace.css"],
      ["src/app/(workspace)/profile/layout.tsx", "frontend/styles/profile.css"],
    ] as const;
    for (const [path, expectedImport] of routeStyles) {
      expect(await readFile(path, "utf8")).toContain(expectedImport);
    }
  });

  it("keeps route transitions and data providers scoped to consumers", async () => {
    await expect(readFile("src/app/template.tsx", "utf8")).rejects.toThrow();

    const rootLayout = await readFile("src/app/layout.tsx", "utf8");
    expect(rootLayout).not.toContain("AppProviders");

    for (const path of [
      "src/frontend/features/authentication/components/resend-verification-form.tsx",
      "src/frontend/features/profile/components/session-list.tsx",
    ]) {
      expect(await readFile(path, "utf8")).toContain("AppProviders");
    }
  });
});
