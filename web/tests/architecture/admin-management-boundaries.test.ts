import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const browserFiles = globSync("src/frontend/features/admin/**/*.{ts,tsx}");
const forbidden = [
  "@/backend/database",
  "@/backend/generated/prisma",
  "@/backend/auth/better-auth",
  "@/backend/repositories",
  "@/backend/storage",
  "@/backend/email",
];

describe("admin architecture boundaries", () => {
  it("keeps browser bundles outside privileged infrastructure", () => {
    for (const file of browserFiles) {
      const source = readFileSync(file, "utf8");
      for (const dependency of forbidden) expect(source).not.toContain(dependency);
    }
  });

  it("contains MUI reset inside the admin mount", () => {
    const source = readFileSync(
      "src/frontend/features/admin/app/admin-app.tsx",
      "utf8",
    );
    expect(source).toContain("ScopedCssBaseline");
    expect(readFileSync("src/app/globals.css", "utf8")).not.toContain("MuiCssBaseline");
  });
});
