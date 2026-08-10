import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";
import { migrationNameMap } from "./migration-name-map.mjs";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is required");

const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: databaseUrl });
const results = [];

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

await client.connect();
try {
  await client.query("BEGIN");
  for (const [legacyName, currentName] of migrationNameMap) {
    const sql = await readFile(
      resolve(webRoot, "prisma/migrations", currentName, "migration.sql"),
    );
    const sourceChecksum = checksum(sql);
    const history = await client.query(
      `SELECT migration_name, checksum, finished_at, rolled_back_at
         FROM "_prisma_migrations"
        WHERE migration_name = ANY($1::text[])
        FOR UPDATE`,
      [[legacyName, currentName]],
    );
    const legacy = history.rows.find(
      (row) => row.migration_name === legacyName,
    );
    const current = history.rows.find(
      (row) => row.migration_name === currentName,
    );
    if (legacy && current) {
      throw new Error(
        `Both legacy and current migration names exist: ${legacyName}, ${currentName}`,
      );
    }
    const applied = current ?? legacy;
    if (!applied) {
      results.push({ legacyName, currentName, status: "NOT_APPLIED" });
      continue;
    }
    if (!applied.finished_at || applied.rolled_back_at) {
      throw new Error(
        `Migration ${applied.migration_name} is not a completed applied migration`,
      );
    }
    if (applied.checksum !== sourceChecksum) {
      throw new Error(
        `Checksum mismatch for ${applied.migration_name}; refusing history reconciliation`,
      );
    }
    if (current) {
      results.push({ legacyName, currentName, status: "ALREADY_CURRENT" });
      continue;
    }
    if (!apply) {
      results.push({ legacyName, currentName, status: "RENAME_REQUIRED" });
      continue;
    }
    await client.query(
      `UPDATE "_prisma_migrations"
          SET migration_name = $1
        WHERE migration_name = $2`,
      [currentName, legacyName],
    );
    results.push({ legacyName, currentName, status: "RENAMED" });
  }
  if (apply) await client.query("COMMIT");
  else await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(JSON.stringify({ mode: apply ? "apply" : "check", results }, null, 2));
if (!apply && results.some((entry) => entry.status === "RENAME_REQUIRED")) {
  process.exitCode = 2;
}
