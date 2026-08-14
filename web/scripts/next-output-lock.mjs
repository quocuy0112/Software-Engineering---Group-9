import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const defaultLockPath = resolve(
  import.meta.dirname,
  "../.local/next-output.lock",
);

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readLock(lockPath) {
  try {
    return JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    return null;
  }
}

export async function acquireNextOutputLock(owner, lockPath = defaultLockPath) {
  await mkdir(dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      const existingLock = await readLock(lockPath);
      if (existingLock && processIsRunning(existingLock.pid)) {
        throw new Error(
          `NEXT_OUTPUT_IN_USE: ${existingLock.owner ?? "another process"} (PID ${existingLock.pid}) is using web/.next`,
          { cause: error },
        );
      }

      await rm(lockPath, { force: true });
      continue;
    }

    const token = randomUUID();
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        owner,
        token,
        acquiredAt: new Date().toISOString(),
      }),
      "utf8",
    );

    let released = false;
    return async () => {
      if (released) return;
      released = true;
      await handle.close();

      const currentLock = await readLock(lockPath);
      if (currentLock?.token === token) {
        await rm(lockPath, { force: true });
      }
    };
  }

  throw new Error("NEXT_OUTPUT_LOCK_FAILED: unable to acquire web/.next lock");
}
