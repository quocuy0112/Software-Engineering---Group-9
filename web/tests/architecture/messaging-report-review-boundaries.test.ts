import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Feature 013 messaging-report review boundaries", () => {
  it("keeps messaging reports separate from general moderation", () => {
    const adminApp = read("src/frontend/features/admin/app/admin-app.tsx");
    expect(adminApp).toContain('name="moderation-reports"');
    expect(adminApp).toContain('name="messaging-reports"');
    expect(read("src/app/api/admin/moderation-reports/route.ts")).not.toMatch(
      /messagingReport/u,
    );
  });

  it("selects one evidence relation and never conversation messages", () => {
    const repository = read(
      "src/backend/repositories/admin/prisma-admin-messaging-report-repository.ts",
    );
    expect(repository).toContain("evidenceMessage:");
    expect(repository).not.toMatch(
      /conversation\s*:\s*\{[\s\S]*?messages\s*:/u,
    );
    expect(repository).not.toMatch(/messages\s*:\s*\{/u);
  });

  it("adds no administrator conversation or arbitrary-message route", () => {
    const routes = globSync("src/app/api/admin/**/*route.ts").map((path) =>
      path.replaceAll("\\", "/"),
    );
    expect(routes).not.toContain("src/app/api/admin/conversations/route.ts");
    expect(routes.some((path) => /messaging-messages/u.test(path))).toBe(false);
  });

  it("requires sensitive proof for protected detail and commands", () => {
    expect(
      read("src/app/api/admin/messaging-reports/[reportId]/route.ts"),
    ).toContain("sensitive: true");
    expect(
      read(
        "src/app/api/admin/messaging-reports/[reportId]/[action]/route.ts",
      ),
    ).toContain("sensitive: true");
  });
});
