import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function rootFile(path: string) {
  return readFile(resolve(process.cwd(), "..", path), "utf8");
}

describe("OCR container isolation", () => {
  it("exposes only a group-private Unix socket with no network or database authority", async () => {
    const [compose, app] = await Promise.all([
      rootFile("compose.yaml"),
      rootFile("ocr-engine/src/app.py"),
    ]);
    const ocrService = compose.slice(
      compose.indexOf("  ocr-engine:"),
      compose.indexOf("  image-search-worker:"),
    );
    expect(ocrService).toContain("network_mode: none");
    expect(ocrService).toContain("read_only: true");
    expect(ocrService).toContain("cap_drop:\n      - ALL");
    expect(ocrService).not.toMatch(/\n\s+ports:/u);
    expect(ocrService).not.toMatch(
      /DATABASE_URL|OPENAI|AWS_|CV_STORAGE|IMAGE_SEARCH_STORAGE/u,
    );
    expect(app).toContain('os.environ.get(\n        "OCR_ENGINE_SOCKET_PATH"');
    expect(app).toContain("os.umask(0o007)");
    expect(app).toContain("uds=socket_path");
    expect(app).not.toMatch(/host=|port=/u);
  });

  it("keeps worker mounts purpose-scoped and drops ambient privileges", async () => {
    const compose = await rootFile("compose.yaml");
    const worker = compose.slice(
      compose.indexOf("  image-search-worker:"),
      compose.lastIndexOf("\nvolumes:"),
    );
    expect(worker).toContain("read_only: true");
    expect(worker).toContain("no-new-privileges:true");
    expect(worker).toContain("cap_drop:\n      - ALL");
    expect(worker).toContain(
      "./web/.local/image-search-storage:/app/.local/image-search-storage",
    );
    expect(worker).not.toContain("cv-storage");
  });
});
