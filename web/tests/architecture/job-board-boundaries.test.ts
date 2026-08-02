import { globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const read = (path: string) => readFileSync(path, "utf8");
const files = (pattern: RegExp) =>
  globSync(`${root.replaceAll("\\", "/")}/**/*.{ts,tsx}`).filter((path) =>
    pattern.test(path.replaceAll("\\", "/")),
  );

describe("Feature 003 architecture boundaries", () => {
  it("keeps job transports free of persistence providers", () => {
    const violations = files(/\/app\/(?:api\/)?(?:jobs|saved-jobs)\//u).filter(
      (path) =>
        /@\/backend\/(?:database|generated|repositories)\//u.test(read(path)),
    );
    expect(violations.map((path) => relative(root, path))).toEqual([]);
  });

  it("keeps Node crypto, Prisma, and private runtime environment out of job client modules", () => {
    const violations = files(/\/frontend\/features\/jobs\//u).filter((path) => {
      const source = read(path);
      return (
        /^\s*["']use client["'];/mu.test(source) &&
        /node:crypto|@\/backend\/(?:database|generated|env|repositories|services)/u.test(
          source,
        )
      );
    });
    expect(violations.map((path) => relative(root, path))).toEqual([]);
  });

  it("loads public Server Component pages through services without internal HTTP", () => {
    for (const path of ["app/jobs/page.tsx", "app/jobs/[slug]/page.tsx"]) {
      const source = read(resolve(root, path));
      expect(source, path).toContain(
        "@/backend/services/jobs/job-discovery-service",
      );
      expect(source, path).not.toMatch(
        /fetch\s*\(|@\/backend\/(?:database|generated|repositories)\//u,
      );
    }
  });

  it("uses the existing session boundary and never introduces a second session model", () => {
    const boundary = read(
      resolve(root, "backend/security/job-request-boundary.ts"),
    );
    expect(boundary).toContain("requireSession");
    expect(boundary).toContain("requireAccountRequest");
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema.match(/^model Session \{/gmu)).toHaveLength(1);
  });

  it("keeps application and report enforcement human-controlled", () => {
    const jobSources = files(/\/(?:backend|app)\/.*jobs?\//u)
      .map(read)
      .join("\n");
    expect(jobSources).not.toMatch(
      /jobPosting\.(?:update|delete)|status:\s*["']REMOVED["']/u,
    );
    expect(jobSources).toContain('stage: "APPLIED"');
  });
});
