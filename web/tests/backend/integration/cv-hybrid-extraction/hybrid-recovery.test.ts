import { access, mkdir, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { PrivateRasterWorkspace } from "@/backend/cv/extraction/private-raster-workspace";

describe("hybrid raster recovery", () => {
  it("cleans idempotently and refuses non-owned recursive targets", async () => {
    const workspace = await PrivateRasterWorkspace.create();
    await workspace.dispose();
    await workspace.dispose();
    await expect(access(workspace.path)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(PrivateRasterWorkspace.disposeOwned(tmpdir())).rejects.toThrow(
      "CV_RASTER_PATH_INVALID",
    );
  });

  it("removes only stale owned workspaces during startup reconciliation", async () => {
    const workspace = await PrivateRasterWorkspace.create();
    const old = new Date(Date.now() - 31 * 60_000);
    await mkdir(workspace.path, { recursive: true });
    await utimes(workspace.path, old, old);
    expect(await PrivateRasterWorkspace.cleanupStale()).toBeGreaterThanOrEqual(
      1,
    );
    await expect(access(workspace.path)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
