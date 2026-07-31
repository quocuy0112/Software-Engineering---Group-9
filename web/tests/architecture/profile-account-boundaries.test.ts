import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { globSync } from "node:fs";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(file, "utf8");
const files = (pattern: RegExp) =>
  globSync(`${root.replaceAll("\\", "/")}/**/*.{ts,tsx}`).filter((file) =>
    pattern.test(file.replaceAll("\\", "/")),
  );

describe("Feature 002 architecture boundaries", () => {
  it("provides the shared foundation modules", () => {
    for (const path of [
      "backend/time/clock.ts",
      "backend/security/plain-text/plain-text-normalizer.ts",
      "backend/security/protected-recipient/protected-outbox-recipient.ts",
      "backend/security/network-source/network-source-protector.ts",
      "backend/security/account-request-boundary.ts",
      "backend/repositories/account/email-address-claim-coordinator.ts",
    ]) {
      expect(
        readFileSync(resolve(root, path), "utf8").length,
        path,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps Prisma and generated database clients out of account routes", () => {
    const violations = files(/\/app\/api\/account\//).filter((file) =>
      /@\/backend\/(?:database\/prisma|generated\/prisma)/.test(read(file)),
    );
    expect(violations.map((file) => relative(root, file))).toEqual([]);
  });

  it("keeps sanitizer and Node crypto out of client modules", () => {
    const violations = files(/\/frontend\/|\/app\//).filter((file) => {
      const source = read(file);
      return (
        /^\s*["']use client["'];/m.test(source) &&
        /(?:sanitize-html|node:crypto|protected-outbox-recipient|network-source-protector)/.test(
          source,
        )
      );
    });
    expect(violations.map((file) => relative(root, file))).toEqual([]);
  });

  it("does not call internal account HTTP endpoints from Server Components", () => {
    const violations = files(/\/app\/.*\/page\.tsx$/).filter((file) => {
      const source = read(file);
      return (
        !/^\s*["']use client["'];/m.test(source) &&
        /fetch\s*\(\s*[`"']\/api\/account\//.test(source)
      );
    });
    expect(violations.map((file) => relative(root, file))).toEqual([]);
  });

  it("routes every source email claim through the common coordinator", () => {
    const claimWriters = files(/\/backend\/repositories\//).filter((file) => {
      const source = read(file);
      return (
        !file.includes("/generated/") &&
        /(?:userAccount|emailChangeRequest)\.(?:create|upsert)/.test(source) &&
        /normalized(?:Proposed)?Email/.test(source)
      );
    });
    const violations = claimWriters.filter(
      (file) =>
        !/email-address-claim-coordinator/.test(read(file)) &&
        !file.endsWith("email-address-claim-coordinator.ts"),
    );
    expect(violations.map((file) => relative(root, file))).toEqual([]);
  });

  it("retains Better Auth Session as the sole browser-session model", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema.match(/^model Session \{/gm)).toHaveLength(1);
    expect(schema).not.toMatch(/^model (?:AccountSession|ProfileSession) \{/gm);
  });
});
