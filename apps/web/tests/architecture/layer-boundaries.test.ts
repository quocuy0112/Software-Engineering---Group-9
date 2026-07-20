import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function files(root: string): Promise<string[]> { return (await readdir(root, { withFileTypes: true })).flatMap((entry) => entry.isDirectory() ? [] : [join(root, entry.name)]); }
describe("application layers", () => {
  it("does not implement Pages Router APIs", async () => { await expect(readdir("src/pages/api")).rejects.toThrow(); });
  it("keeps health transport free of providers", async () => { const source = await readFile("src/app/api/health/route.ts", "utf8"); expect(source).not.toMatch(/@prisma\/client|resend/); });
  it("keeps presentation free of server providers", async () => { for (const path of await files("src/app")) expect(await readFile(path, "utf8")).not.toMatch(/@prisma\/client|from ["']resend["']/); });
});
