import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { homeCopy } from "@/frontend/features/home/home-copy";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) =>
      leafPaths(item, prefix ? `${prefix}.${key}` : key),
    );
  return [prefix];
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

describe("Home localization boundary", () => {
  it("keeps the complete Home-authored catalog structurally identical in English and Vietnamese", () => {
    expect(leafPaths(homeCopy.vi).sort()).toEqual(leafPaths(homeCopy.en).sort());
    for (const locale of [homeCopy.en, homeCopy.vi])
      for (const path of leafPaths(locale)) expect(path).not.toBe("");
  });

  it("keeps visible, assistive, placeholder, and status prose out of Home components", async () => {
    const roots = [
      resolve(process.cwd(), "src/frontend/features/home/components"),
      resolve(process.cwd(), "src/frontend/features/home/client"),
    ];
    const files = (await Promise.all(roots.map(sourceFiles))).flat();
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/>(?:[ \t]*)[A-Za-zÀ-ỹ][^\r\n<{]*</u.test(source)) violations.push(file);
      if (/\b(?:aria-label|placeholder|title)=['"][A-Za-zÀ-ỹ]/u.test(source)) violations.push(file);
    }
    expect([...new Set(violations)]).toEqual([]);
  });
});
