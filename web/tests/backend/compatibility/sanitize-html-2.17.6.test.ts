import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import sanitizeHtml from "sanitize-html";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

const STRICT_PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
};

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory()
          ? sourceFiles(path)
          : Promise.resolve([path]);
      }),
    )
  ).flat();
}

describe("sanitize-html 2.17.6 compatibility gate", () => {
  it("resolves the exact runtime and type-package pins", () => {
    const runtime = require("sanitize-html/package.json") as {
      version: string;
    };
    const types = require("@types/sanitize-html/package.json") as {
      version: string;
    };

    expect(runtime.version).toBe("2.17.6");
    expect(types.version).toBe("2.16.1");
  });

  it.each([
    ["script", "<script>globalThis.__xss = true</script>Safe", "Safe"],
    ["style", "<style>body{display:none}</style>Visible", "Visible"],
    [
      "event handler",
      '<img src=x onerror="globalThis.__xss=true">Candidate',
      "Candidate",
    ],
    [
      "malformed nesting",
      "<<script>script>alert(1)<</script>/script>Profile",
      "&lt;/script&gt;Profile",
    ],
    [
      "SVG handler",
      '<svg><g onload="globalThis.__xss=true"></g></svg>Skills',
      "Skills",
    ],
    [
      "attribute breakout",
      '"><script>globalThis.__xss=true</script>Education',
      '"&gt;Education',
    ],
  ])(
    "reduces the malformed-XSS %s case to inert text",
    (_, input, expected) => {
      const result = sanitizeHtml(input, STRICT_PLAIN_TEXT_OPTIONS);

      expect(result).toBe(expected);
      expect(result).not.toMatch(
        /<[^>]*>|onerror|onload|globalThis|alert\(|body\{/i,
      );
    },
  );

  it("preserves ordinary Unicode text and Vietnamese diacritics", () => {
    expect(
      sanitizeHtml(
        "Kỹ sư phần mềm – Thành phố Hồ Chí Minh",
        STRICT_PLAIN_TEXT_OPTIONS,
      ),
    ).toBe("Kỹ sư phần mềm – Thành phố Hồ Chí Minh");
  });

  it("performs sanitization without network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      sanitizeHtml("<strong>Offline</strong>", STRICT_PLAIN_TEXT_OPTIONS);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("has no client or App Router imports", async () => {
    for (const root of ["src/frontend", "src/app"]) {
      for (const path of await sourceFiles(root)) {
        if (![".ts", ".tsx"].includes(extname(path))) continue;
        expect(await readFile(path, "utf8")).not.toMatch(
          /from\s+["']sanitize-html["']|require\(["']sanitize-html["']\)/,
        );
      }
    }
  });

  it("runs under the approved Node runtime", () => {
    expect(process.versions.node).toMatch(/^24[.]18[.]/);
  });
});
