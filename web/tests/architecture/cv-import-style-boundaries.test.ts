import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? files(path) : Promise.resolve([path]);
      }),
    )
  ).flat();
}

const featureRoots = [
  resolve(process.cwd(), "src/frontend/features/cv-import"),
  resolve(process.cwd(), "src/app/(workspace)/profile/cv-imports"),
];

describe("Feature 004 stylesheet ownership", () => {
  it("allows only optional adjacent same-basename CSS Modules", async () => {
    const featureFiles = (await Promise.all(featureRoots.map(files))).flat();
    for (const stylesheet of featureFiles.filter((path) =>
      path.endsWith(".module.css"),
    )) {
      const owner = stylesheet.replace(/\.module[.]css$/u, ".tsx");
      expect(featureFiles, relative(process.cwd(), stylesheet)).toContain(
        owner,
      );
      expect(dirname(owner)).toBe(dirname(stylesheet));
      expect(await readFile(owner, "utf8")).toContain(basename(stylesheet));
      const contents = await readFile(stylesheet, "utf8");
      expect(contents).not.toMatch(/:global/u);
      expect(contents.trim().length).toBeGreaterThan(0);
    }
  });

  it("allows a module to be imported only by its matching TSX owner", async () => {
    const featureFiles = (await Promise.all(featureRoots.map(files))).flat();
    const modules = featureFiles.filter((path) => path.endsWith(".module.css"));
    for (const path of featureFiles.filter(
      (candidate) => extname(candidate) === ".tsx",
    )) {
      const contents = await readFile(path, "utf8");
      for (const modulePath of modules) {
        const moduleName = basename(modulePath);
        if (!contents.includes(moduleName)) continue;
        expect(basename(path, ".tsx")).toBe(
          basename(modulePath, ".module.css"),
        );
      }
    }
  });

  it("forbids feature styles directories and catch-all stylesheets", async () => {
    const featureFiles = (await Promise.all(featureRoots.map(files))).flat();
    for (const path of featureFiles) {
      expect(relative(process.cwd(), path)).not.toMatch(
        /(?:^|[\\/])styles[\\/]|cv-import(?:s)?[.]css$|index[.]css$/u,
      );
    }
  });

  it("keeps Feature 004 selectors/imports out of global and shared styles", async () => {
    for (const path of await files(resolve(process.cwd(), "src"))) {
      if (extname(path) !== ".css" || path.includes("cv-import")) continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(process.cwd(), path)).not.toMatch(
        /cv-import|cv-upload|cv-review|cv-draft/u,
      );
    }
  });
});
