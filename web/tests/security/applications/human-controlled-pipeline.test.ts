import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("human controlled pipeline", () => {
  it("allows only recruiter-side application stage authority to write a recruitment stage", () => {
    for (const path of globSync("src/backend/**/*.{ts,tsx}")) {
      const source = readFileSync(path, "utf8");
      if (path.replaceAll("\\", "/").endsWith("services/jobs/application-stage-service.ts")) continue;
      if (path.includes("repositories/jobs/prisma-job-application-repository")) continue;
      expect(source, path).not.toMatch(/data:\s*\{\s*stage:\s*["']HIRED["']/u);
    }
  });
});
