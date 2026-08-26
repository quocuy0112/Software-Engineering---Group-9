import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
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

const source = resolve(process.cwd(), "src");

describe("Feature 005 architecture boundaries", () => {
  it("mounts job search inside supported headers instead of the root or authentication shell", async () => {
    const [
      rootLayout,
      authLayout,
      publicHome,
      homeHeader,
      jobHeader,
      workspaceShell,
      liveJobSearch,
    ] = await Promise.all([
      readFile(resolve(source, "app/layout.tsx"), "utf8"),
      readFile(resolve(source, "app/(auth)/layout.tsx"), "utf8"),
      readFile(
        resolve(source, "frontend/features/home/components/home-page-view.tsx"),
        "utf8",
      ),
      readFile(
        resolve(
          source,
          "frontend/features/home/components/home-authenticated-actions.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          source,
          "frontend/features/jobs/components/job-board-header.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          source,
          "frontend/features/dashboard/components/workspace-shell.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          source,
          "frontend/features/jobs/components/live-job-search-experience.tsx",
        ),
        "utf8",
      ),
    ]);

    expect(rootLayout).not.toContain("<GlobalImageSearch");
    expect(authLayout).not.toContain("<GlobalImageSearch");
    expect(publicHome).toContain("<GlobalImageSearch");
    expect(homeHeader).toContain("<GlobalImageSearch");
    expect(jobHeader).toContain("<GlobalImageSearch");
    expect(workspaceShell).toContain('contentMode === "job-board"');
    expect(workspaceShell).not.toContain("<GlobalImageSearch");
    expect(liveJobSearch).toContain("<GlobalImageSearch");
  });

  it("preserves scanner signatures when resetting the local database", async () => {
    const [resetScript, userResetScript, rootPackage] = await Promise.all([
      readFile(
        resolve(process.cwd(), "../scripts/reset-local-database.mjs"),
        "utf8",
      ),
      readFile(resolve(process.cwd(), "../scripts/db-reset-user.mjs"), "utf8"),
      readFile(resolve(process.cwd(), "../package.json"), "utf8"),
    ]);
    expect(resetScript).toContain('run(docker, ["compose", "down"]);');
    expect(resetScript).toContain(
      'run(docker, ["volume", "rm", postgresVolume]);',
    );
    expect(resetScript).not.toContain('["compose", "down", "-v"]');
    expect(resetScript).toContain('"db:migrate"');
    expect(resetScript).not.toContain('runNpm(["run", "db:seed:jobs"]);');
    expect(resetScript).toContain("Skipping job/company/skill fixture import");
    expect(JSON.parse(rootPackage).scripts["db:reset:empty"]).toBe(
      "node scripts/reset-local-database.mjs --empty",
    );
    expect(JSON.parse(rootPackage).scripts["db:reset"]).toBe(
      "node scripts/db-reset-user.mjs",
    );
    expect(userResetScript).toContain(
      "transaction.authProviderAccount.deleteMany",
    );
    expect(userResetScript).toContain("const userIds = accounts.map");
    expect(userResetScript).not.toContain("Multiple user accounts found");
    expect(userResetScript).toContain("smarthire.cv_retention_mode");
    expect(userResetScript).toContain(
      "Parse jobs reference consent with ON DELETE SET NULL",
    );
    expect(userResetScript).toContain("transaction.emailOutbox.deleteMany");
    expect(userResetScript).toContain(
      "transaction.platformAdministratorGrant.deleteMany",
    );
    expect(userResetScript).toContain(
      "transaction.jobPostReviewVersion.deleteMany",
    );
    expect(userResetScript).toContain(
      "transaction.companyMembership.deleteMany",
    );
    expect(userResetScript).toContain(
      "transaction.companyMembershipHistory.deleteMany",
    );
    expect(userResetScript).toContain("imported catalog");
    expect(userResetScript).toContain('state: "DELETED"');
    expect(userResetScript).toContain("transaction.userAccount.update");
    expect(userResetScript).toContain("email: resetEmail");
  });

  it("keeps image-search routes thin and free of Prisma, storage, OCR, scanner, and providers", async () => {
    for (const path of await files(
      resolve(source, "app/api/jobs/image-searches"),
    )) {
      if (extname(path) !== ".ts") continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(source, path)).not.toMatch(
        /@\/backend\/(?:database|generated|repositories|ocr|image-search\/(?:storage|workers|interpretation))\//u,
      );
      expect(contents, relative(source, path)).not.toMatch(
        /@prisma\/client|from ["']openai["']|from ["']sharp["']/u,
      );
    }
  });

  it("keeps Sharp and Canvas out of frontend/shared and browser bundles", async () => {
    for (const boundary of ["frontend", "shared", "app"]) {
      for (const path of await files(resolve(source, boundary))) {
        if (![".ts", ".tsx"].includes(extname(path))) continue;
        const contents = await readFile(path, "utf8");
        expect(contents, relative(source, path)).not.toMatch(
          /from ["'](?:sharp|@napi-rs\/canvas)["']/u,
        );
      }
    }
  });

  it("enforces purpose-separated search and CV storage modules", async () => {
    const searchFiles = await files(resolve(source, "backend/image-search"));
    for (const path of searchFiles) {
      if (extname(path) !== ".ts") continue;
      expect(await readFile(path, "utf8"), relative(source, path)).not.toMatch(
        /@\/backend\/cv\/(?:storage|encryption)\//u,
      );
    }
    const cvFiles = await files(resolve(source, "backend/cv"));
    for (const path of cvFiles) {
      if (extname(path) !== ".ts") continue;
      expect(await readFile(path, "utf8"), relative(source, path)).not.toMatch(
        /@\/backend\/image-search\/storage\//u,
      );
    }
  });

  it("uses a UDS-only OCR boundary and gives the Python engine no app data access", async () => {
    const [compose, dockerfile, environment] = await Promise.all([
      readFile(resolve(process.cwd(), "../compose.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "../Dockerfile.ocr-engine"), "utf8"),
      readFile(resolve(process.cwd(), "../.env.example"), "utf8"),
    ]);
    expect(environment).toContain(
      "OCR_ENGINE_SOCKET_PATH=/run/smarthire-ocr/ocr.sock",
    );
    expect(environment).not.toMatch(/OCR_ENGINE_(?:URL|HOST|PORT|TCP)=/u);
    expect(compose).toContain("network_mode: none");
    expect(compose).not.toMatch(/ocr-engine:[\s\S]{0,500}\n\s+ports:/u);
    expect(dockerfile).not.toMatch(/DATABASE_URL|OPENAI_API_KEY|CV_STORAGE/u);
  });

  it("defines one exclusive browser session and no OCR/search session mechanism", async () => {
    const schema = await readFile(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema.match(/^model Session \{/gmu)).toHaveLength(1);
    expect(schema).not.toMatch(
      /^model (?:Ocr|ImageSearch|Search)Session \{/gmu,
    );
  });
});
