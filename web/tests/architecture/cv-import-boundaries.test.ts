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
const cvProviderPattern =
  /@aws-sdk\/client-s3|pdfjs-dist|mammoth|yauzl|fast-xml-parser|from ["']openai["']|node:(?:crypto|fs|net|stream)/u;

describe("Feature 004 architecture boundaries", () => {
  it("establishes the server-only CV boundary", async () => {
    const backendFiles = await files(resolve(source, "backend/cv"));
    expect(backendFiles.length).toBeGreaterThan(0);
    for (const path of backendFiles) {
      if (![".ts", ".tsx"].includes(extname(path))) continue;
      const contents = await readFile(path, "utf8");
      if (cvProviderPattern.test(contents)) {
        expect(contents, relative(source, path)).toMatch(
          /^import ["']server-only["'];/u,
        );
      }
    }
  });

  it("keeps frontend/shared code free of backend, Node, Prisma, and providers", async () => {
    for (const boundary of ["frontend", "shared"]) {
      for (const path of await files(resolve(source, boundary))) {
        if (![".ts", ".tsx"].includes(extname(path))) continue;
        const contents = await readFile(path, "utf8");
        expect(contents, relative(source, path)).not.toMatch(/@\/backend\//u);
        expect(contents, relative(source, path)).not.toMatch(cvProviderPattern);
        expect(contents, relative(source, path)).not.toMatch(
          /@prisma\/client|generated\/prisma/u,
        );
        if (path.includes("cv-import")) {
          expect(contents, relative(source, path)).not.toMatch(
            /localStorage|sessionStorage|indexedDB/u,
          );
        }
      }
    }
  });

  it("keeps CV Route Handlers thin and provider-free", async () => {
    const apiRoot = resolve(source, "app/api/account");
    for (const path of await files(apiRoot)) {
      if (extname(path) !== ".ts" || !path.includes("cv-")) continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(source, path)).not.toMatch(
        /@\/backend\/(?:database|generated|repositories|cv\/(?:storage|scanning|extraction|parsing|encryption))\//u,
      );
      expect(contents, relative(source, path)).not.toMatch(cvProviderPattern);
    }
  });

  it("keeps parser implementations pure and side-effect free", async () => {
    const parsingRoot = resolve(source, "backend/cv/parsing");
    for (const path of await files(parsingRoot)) {
      if (extname(path) !== ".ts") continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(source, path)).not.toMatch(
        /@\/backend\/(?:database|repositories|services|auth)\//u,
      );
      expect(contents, relative(source, path)).not.toMatch(
        /fetch\s*\(|localStorage|sessionStorage/u,
      );
    }
  });

  it("has no original-CV retrieval/download or public URL surface", async () => {
    for (const path of await files(source)) {
      if (![".ts", ".tsx"].includes(extname(path))) continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(source, path)).not.toMatch(
        /(?:get|create|generate)(?:Public|Download|Presigned)Url|original-cv\/download/u,
      );
    }
    const contentRoute = await readFile(
      resolve(source, "app/api/account/cv-imports/[uploadId]/content/route.ts"),
      "utf8",
    );
    expect(contentRoute).not.toMatch(/export\s+async\s+function\s+GET\b/u);
  });

  it("rejects custom provider endpoints and a second session/JWT mechanism", async () => {
    const environment = await readFile(
      resolve(process.cwd(), "../.env.example"),
      "utf8",
    );
    expect(environment).not.toMatch(
      /OPENAI_BASE_URL|CV_OPENAI_ENDPOINT|CV_CLAMD_HOST|CV_CLAMD_PORT/u,
    );
    const schema = await readFile(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema.match(/^model Session \{/gmu)).toHaveLength(1);
    expect(schema).not.toMatch(/^model CvSession|^model CandidateSession/gmu);
    for (const path of await files(resolve(source, "backend/cv"))) {
      if (extname(path) !== ".ts") continue;
      expect(await readFile(path, "utf8"), relative(source, path)).not.toMatch(
        /jsonwebtoken|jose|jwt\.sign|new SignJWT/u,
      );
    }
  });

  it("prevents Server Components from calling internal CV HTTP APIs", async () => {
    for (const path of await files(resolve(source, "app"))) {
      if (extname(path) !== ".tsx") continue;
      const contents = await readFile(path, "utf8");
      expect(contents, relative(source, path)).not.toMatch(
        /fetch\s*\([^)]*\/api\/account\/cv-/u,
      );
    }
  });
});
