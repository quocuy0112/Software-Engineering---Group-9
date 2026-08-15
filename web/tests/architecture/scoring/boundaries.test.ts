import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

describe("scoring boundaries", () => {
  it("keeps provider and document access out of the frontend feature", async () => {
    const frontend = await readFile(resolve(sourceRoot, "frontend/features/recruiter-applications/candidate-ranking-list.tsx"), "utf8");
    expect(frontend).not.toContain("openai");
    expect(frontend).not.toContain("storageKeyEncrypted");
    expect(frontend).toContain("useRankedCandidates");
  });

  it("does not give scoring code a stage mutation authority", async () => {
    const source = await readFile(resolve(sourceRoot, "backend/scoring/services/scoring-publication-service.ts"), "utf8");
    expect(source).not.toContain("jobApplication.update");
    expect(source).not.toContain("stage:");
  });
});
