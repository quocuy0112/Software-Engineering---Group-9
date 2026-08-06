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
