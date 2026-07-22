import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(resolve(path, entry.name))
          : Promise.resolve([resolve(path, entry.name)]),
      ),
    )
  ).flat();
}
describe("auth route motion policy", () => {
  it("imports no Lenis in auth or security shells", async () => {
    for (const directory of [
      "src/app/(auth)",
      "src/app/settings",
      "src/components/auth",
    ]) {
      for (const file of await walk(resolve(process.cwd(), directory))) {
        expect(await readFile(file, "utf8")).not.toMatch(/lenis/i);
      }
    }
  });
});
