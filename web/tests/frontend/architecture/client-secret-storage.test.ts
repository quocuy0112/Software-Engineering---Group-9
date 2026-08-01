import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? files(path) : Promise.resolve([path]);
      }),
    )
  ).flat();
}
describe("browser state policy", () => {
  it("keeps the shared UI store allowlisted and rejects browser secret persistence", async () => {
    const store = await readFile(
      resolve(process.cwd(), "src/frontend/stores/ui.ts"),
      "utf8",
    );
    expect(store).not.toMatch(/password|token|secret|code|cookie/i);
    const roots = await Promise.all(["src/frontend", "src/app"].map(files));
    for (const file of roots.flat()) {
      const source = await readFile(file, "utf8");
      expect(source).not.toMatch(
        /(?:localStorage|sessionStorage)\.setItem\s*\([^,]*(?:password|token|secret|code|cookie)/i,
      );
    }
  });

  it("keeps Feature 002 profile, identity, preference, proof, and password data memory-only", async () => {
    const featureFiles = [
      "src/frontend/features/profile/client/use-account-identity.ts",
      "src/frontend/features/profile/client/use-account-preferences.ts",
      "src/frontend/features/profile/client/use-password-change.ts",
      "src/frontend/features/profile/client/use-profile-editor.ts",
      "src/frontend/features/profile/components/account-identity-form.tsx",
      "src/frontend/features/profile/components/account-preferences-form.tsx",
      "src/frontend/features/profile/components/email-change-form.tsx",
      "src/frontend/features/profile/components/password-change-form.tsx",
      "src/frontend/features/profile/components/profile-account-view.tsx",
      "src/frontend/features/profile/components/profile-basics-form.tsx",
      "src/frontend/features/profile/components/profile-education-form.tsx",
      "src/frontend/features/profile/components/profile-experience-form.tsx",
      "src/frontend/features/profile/components/profile-preferences-view.tsx",
      "src/frontend/features/profile/components/profile-skills-form.tsx",
      "src/frontend/features/profile/components/profile-social-links-form.tsx",
      "src/frontend/features/profile/components/totp-enrollment.tsx",
      "src/frontend/features/profile/components/two-factor-management.tsx",
      "src/frontend/features/profile/components/verify-email-change-form.tsx",
      "src/app/(auth)/verify-email-change/page.tsx",
    ];
    const persistence =
      /localStorage|sessionStorage|indexedDB|cookieStore|document\.cookie|caches\.(?:open|match|put)|persistQueryClient/u;
    for (const path of featureFiles) {
      expect(
        await readFile(resolve(process.cwd(), path), "utf8"),
        path,
      ).not.toMatch(persistence);
    }
  });

  it("does not persist values under secret-bearing browser storage keys", async () => {
    const sensitive =
      /password|proof|verification|recipient|csrf|cookie|session(?:Id|Token)|profile(?:Body|Payload)|rawHeaders?/iu;
    for (const file of (
      await Promise.all(["src/frontend", "src/app"].map(files))
    ).flat()) {
      if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
      const source = await readFile(file, "utf8");
      for (const call of source.matchAll(
        /(?:localStorage|sessionStorage)\.setItem\s*\(([^,\n]+)/gmu,
      )) {
        expect(call[1], file).not.toMatch(sensitive);
      }
    }
  });
});
