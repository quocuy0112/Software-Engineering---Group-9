import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquireNextOutputLock } from "../../scripts/next-output-lock.mjs";

describe("custom server runtime boundaries", () => {
  it("does not apply the React Server condition to the whole Next process", () => {
    const packageSource = JSON.parse(readFileSync("package.json", "utf8"));

    for (const scriptName of [
      "dev",
      "dev:web",
      "start",
      "smoke:messaging:server",
      "smoke:dev-server",
    ]) {
      expect(packageSource.scripts[scriptName]).toContain(
        "--import ./scripts/register-server-runtime.mjs",
      );
      expect(packageSource.scripts[scriptName]).not.toContain(
        "--conditions=react-server",
      );
    }
  });

  it("preloads tsx without Windows user lookup failures", () => {
    const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
    const tsxRuntime = readFileSync("scripts/register-tsx-runtime.mjs", "utf8");

    for (const scriptName of ["dev", "dev:web", "start"]) {
      expect(packageSource.scripts[scriptName]).toContain(
        "--import ./scripts/register-tsx-runtime.mjs",
      );
    }
    expect(packageSource.scripts["email:worker"]).toContain(
      "./scripts/register-tsx-runtime.mjs",
    );
    expect(tsxRuntime).toContain("process.geteuid");
    expect(tsxRuntime).toContain('await import("tsx")');
  });

  it("supports backend server-only markers without changing React exports", () => {
    const loaderSource = readFileSync("scripts/server-only-loader.mjs", "utf8");
    expect(loaderSource).toContain('specifier === "server-only"');
    expect(loaderSource).not.toMatch(/react(?:-dom)?/u);

    expect(() =>
      execFileSync(
        process.execPath,
        [
          "--import",
          "./scripts/register-server-runtime.mjs",
          "--input-type=module",
          "--eval",
          "import 'server-only'; import { createRequire } from 'node:module'; createRequire(import.meta.url)('server-only')",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      ),
    ).not.toThrow();
  });

  it("rejects concurrent owners of one Next output directory", async () => {
    const lockPath = join(
      tmpdir(),
      `smarthire-next-output-${randomUUID()}`,
      "next-output.lock",
    );
    const releaseFirstLock = await acquireNextOutputLock("first", lockPath);

    try {
      await expect(acquireNextOutputLock("second", lockPath)).rejects.toThrow(
        /NEXT_OUTPUT_IN_USE/u,
      );
    } finally {
      await releaseFirstLock();
      await rm(dirname(lockPath), { recursive: true, force: true });
    }
  });

  it("holds the output lock for the complete Next build", () => {
    const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
    const buildSource = readFileSync("scripts/run-next-build.mjs", "utf8");

    expect(packageSource.scripts).not.toHaveProperty("prebuild");
    expect(packageSource.scripts.build).toBe("node scripts/run-next-build.mjs");
    expect(buildSource).toContain('acquireNextOutputLock("next-build")');
    expect(buildSource.indexOf("spawn(")).toBeLessThan(
      buildSource.indexOf("releaseNextOutputLock()"),
    );
  });
});
