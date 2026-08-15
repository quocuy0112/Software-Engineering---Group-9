import { globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const read = (path: string) => readFileSync(path, "utf8");
const sourceFiles = () =>
  globSync(`${root.replaceAll("\\", "/")}/**/*.{ts,tsx}`);

describe("job-post review architecture boundaries", () => {
  it("keeps review routes behind services and App Router only", () => {
    const routes = sourceFiles().filter(
      (path) =>
        path.replaceAll("\\", "/").includes("/app/api/") &&
        path.includes("job-post-review"),
    );
    const violations = routes.filter((path) =>
      /@\/backend\/(?:database|generated|repositories)\//u.test(read(path)),
    );
    expect(violations.map((path) => relative(root, path))).toEqual([]);
    expect(
      sourceFiles().some((path) =>
        path.replaceAll("\\", "/").includes("/pages/api/job-post-review"),
      ),
    ).toBe(false);
  });

  it("allows only the JSON catalogue repository to import file persistence", () => {
    const jobSources = sourceFiles().filter(
      (path) =>
        path.replaceAll("\\", "/").includes("/backend/") &&
        path.toLowerCase().includes("job"),
    );
    const directFileUsers = jobSources.filter((path) =>
      /node:fs|readFile\(|writeFile\(/u.test(read(path)),
    );
    expect(directFileUsers.map((path) => relative(root, path))).toEqual([
      "backend\\repositories\\jobs\\json-job-catalogue-repository.ts",
    ]);
  });

  it("keeps review persistence server-only and the existing browser session exclusive", () => {
    for (const path of [
      "backend/repositories/jobs/json-job-catalogue-repository.ts",
      "backend/repositories/jobs/prisma-job-post-review-repository.ts",
      "backend/jobs/review/job-post-review-service.ts",
    ])
      expect(read(resolve(root, path))).toMatch(/^import "server-only";/u);
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema.match(/^model Session \{/gmu)).toHaveLength(1);
  });
});
