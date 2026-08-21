import "server-only";

import { spawn } from "node:child_process";

function dumpUrl() {
  const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "");
  url.searchParams.delete("schema");
  return url.toString();
}

export async function createPostgresBackup() {
  return new Promise<Buffer>((resolve, reject) => {
    const process = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--dbname=${dumpUrl()}`], { stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    process.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    process.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    process.on("error", () => reject(new Error("BACKUP_DUMP_UNAVAILABLE")));
    process.on("close", (code) => {
      if (code === 0) return resolve(Buffer.concat(output));
      const detail = Buffer.concat(errors).toString("utf8").toLowerCase();
      if (detail.includes("password authentication failed")) return reject(new Error("BACKUP_DATABASE_AUTH_FAILED"));
      if (detail.includes("connection") || detail.includes("could not connect")) return reject(new Error("BACKUP_DATABASE_UNAVAILABLE"));
      reject(new Error("BACKUP_DUMP_FAILED"));
    });
  });
}
