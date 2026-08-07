import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const WORKSPACE_PREFIX = "smarthire-cv-ocr-";
const STALE_AFTER_MS = 30 * 60_000;

function isWithin(parent: string, child: string) {
  const path = relative(resolve(parent), resolve(child));
  return Boolean(path) && !path.startsWith("..") && !isAbsolute(path);
}

export class PrivateRasterWorkspace {
  private disposed = false;

  private constructor(readonly path: string) {}

  static async create(parent = tmpdir()) {
    const path = join(resolve(parent), `${WORKSPACE_PREFIX}${randomUUID()}`);
    await mkdir(path, { mode: 0o700 });
    await chmod(path, 0o700);
    return new PrivateRasterWorkspace(path);
  }

  async writePng(unitKey: string, bytes: Uint8Array): Promise<string> {
    if (this.disposed) throw new Error("CV_RASTER_WORKSPACE_DISPOSED");
    if (!/^[A-Za-z0-9_-]{1,100}$/u.test(unitKey) || bytes.byteLength < 8)
      throw new Error("CV_RASTER_INVALID");
    const signature = Buffer.from(bytes.subarray(0, 8)).toString("hex");
    if (signature !== "89504e470d0a1a0a") throw new Error("CV_RASTER_INVALID");
    const path = join(this.path, `${unitKey}.png`);
    if (!isWithin(this.path, path)) throw new Error("CV_RASTER_PATH_INVALID");
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.chmod(0o600);
    } finally {
      await file.close();
    }
    return path;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await rm(this.path, { recursive: true, force: true });
  }

  static async disposeOwned(path: string): Promise<void> {
    const root = resolve(tmpdir());
    const target = resolve(path);
    if (
      !isWithin(root, target) ||
      !basename(target).startsWith(WORKSPACE_PREFIX)
    )
      throw new Error("CV_RASTER_PATH_INVALID");
    try {
      const metadata = await lstat(target);
      if (metadata.isSymbolicLink() || !metadata.isDirectory())
        throw new Error("CV_RASTER_PATH_INVALID");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return;
      throw error;
    }
    await rm(target, { recursive: true, force: true });
  }

  static async cleanupStale(parent = tmpdir(), now = new Date()) {
    const root = resolve(parent);
    let removed = 0;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(WORKSPACE_PREFIX))
        continue;
      const path = resolve(root, entry.name);
      if (!isWithin(root, path) || basename(path) !== entry.name) continue;
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) continue;
      if (now.getTime() - metadata.mtimeMs < STALE_AFTER_MS) continue;
      await rm(path, { recursive: true, force: true });
      removed += 1;
    }
    return removed;
  }
}
