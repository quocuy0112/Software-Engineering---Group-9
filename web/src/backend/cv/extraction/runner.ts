import "server-only";

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import {
  DocumentExtractionError,
  type ExtractionChildRequest,
  type ExtractionChildResult,
} from "./document-extractor";

function terminateTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

export async function runExtractionChild(
  request: ExtractionChildRequest,
): Promise<ExtractionChildResult> {
  return new Promise((resolve, reject) => {
    const relativeEntry = "src/backend/cv/extraction/child-entry.ts";
    const childEntry = [
      resolvePath(process.cwd(), relativeEntry),
      resolvePath(process.cwd(), "web", relativeEntry),
    ].find((candidate) => existsSync(candidate));
    if (!childEntry) {
      reject(new DocumentExtractionError("EXTRACTION_FAILED"));
      return;
    }
    const child = spawn(
      process.execPath,
      [
        `--max-old-space-size=${request.limits.maximumOldSpaceMb}`,
        "--conditions=react-server",
        "--import",
        "tsx",
        childEntry,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      },
    );
    const output: Buffer[] = [];
    const diagnostics: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (error?: Error, value?: ExtractionChildResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (value) resolve(value);
      else reject(new DocumentExtractionError("EXTRACTION_FAILED"));
    };
    const timer = setTimeout(() => {
      terminateTree(child);
      finish(new DocumentExtractionError("EXTRACTION_TIMEOUT"));
    }, request.limits.timeoutMs);
    timer.unref();
    child.once("error", () =>
      finish(new DocumentExtractionError("EXTRACTION_FAILED")),
    );
    // On Windows a short-lived extraction child can close its stdin while the
    // parent is still flushing the request.  Node otherwise emits an
    // unhandled `write EOF`/`EPIPE` error and takes down the scoring worker.
    // The exit handler below remains the source of truth for the child result.
    child.stdin?.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EOF" && error.code !== "EPIPE" && !settled) {
        finish(new DocumentExtractionError("EXTRACTION_FAILED"));
      }
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > request.limits.maximumOutputBytes * 4) {
        terminateTree(child);
        finish(new DocumentExtractionError("OUTPUT_LIMIT"));
      } else output.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => diagnostics.push(Buffer.from(chunk)));
    child.once("exit", (code) => {
      if (settled) return;
      try {
        const message = JSON.parse(Buffer.concat(output).toString("utf8")) as
          | { ok: true; value: ExtractionChildResult }
          | { ok: false; code: string };
        if (code !== 0 || !message.ok)
          finish(
            new DocumentExtractionError(
              message.ok ? "EXTRACTION_FAILED" : message.code,
            ),
          );
        else finish(undefined, message.value);
      } catch {
        if (process.env.CV_EXTRACTION_DEBUG === "1") {
          console.warn(`[cv-extraction] child exited code=${String(code)} stderr=${Buffer.concat(diagnostics).toString("utf8").slice(0, 500)}`);
        }
        finish(new DocumentExtractionError("EXTRACTION_FAILED"));
      }
    });
    try {
      child.stdin?.end(
        JSON.stringify({
          kind: request.kind,
          source: Buffer.from(request.source).toString("base64"),
          limits: request.limits,
        }),
      );
    } catch {
      // The child exit event reports the actual extraction outcome.
    }
  });
}
