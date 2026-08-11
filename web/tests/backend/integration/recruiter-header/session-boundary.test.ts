import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recruiter header session boundary", () => {
  it("uses the existing Better Auth session boundary without a second credential", async () => {
    const route = await readFile(
      resolve(process.cwd(), "src/app/api/recruiter/header-status/route.ts"),
      "utf8",
    );
    expect(route).toContain("requireSession");
    expect(route).not.toContain("localStorage");
    expect(route).not.toContain("sessionStorage");
    expect(route).not.toContain("Authorization");
    expect(route).not.toContain("jwt");
  });
});
