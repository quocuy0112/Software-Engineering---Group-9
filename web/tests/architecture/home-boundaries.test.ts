import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

async function names(path: string) {
  try {
    return await readdir(resolve(process.cwd(), path), { recursive: true });
  } catch {
    return [];
  }
}

describe("Home boundaries", () => {
  it("keeps a single session-aware page composition", async () => {
    const view = await source(
      "src/frontend/features/home/components/home-page-view.tsx",
    );
    expect(view).toContain("<HomeHeader");
    expect(view).toContain("<HomeTrendingJobs");
    expect(view).toContain("<HomeFooter");
    expect(view).not.toContain("HomeAuthenticatedActions");
  });

  it("reuses established boundaries instead of creating Home APIs or workflows", async () => {
    const context = await source(
      "src/backend/services/home/get-home-page-context.ts",
    );
    const save = await source(
      "src/frontend/features/home/components/home-save-job-action.tsx",
    );
    expect(context).toContain("JobDiscoveryService");
    expect(save).toContain("/api/saved-jobs/");
    expect(context).not.toContain("create(");
    expect(context).not.toContain("update(");
  });

  it("adds no Home endpoint, migration, persistence, CMS, social, payment, or recruitment workflow", async () => {
    expect(await names("src/app/api/home")).toEqual([]);
    expect((await names("prisma/migrations")).filter((name) => /home|smart.?match/iu.test(name))).toEqual([]);
    const files = await names("src/frontend/features/home");
    expect(files.filter((name) => /chat|payment|order|cms|comment|video|interview|pipeline/iu.test(name))).toEqual([]);
    const schema = await source("prisma/schema.prisma");
    expect(schema).not.toMatch(/model\s+(?:HomePage|HomeMatch|SmartMatch|HomeFeed)/u);
  });
});
