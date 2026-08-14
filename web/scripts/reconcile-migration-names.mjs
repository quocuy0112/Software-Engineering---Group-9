import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";
import {
  migrationChecksumAliases,
  migrationNameMap,
} from "./migration-name-map.mjs";

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
    const legacyRows = history.rows.filter(
      (row) => row.migration_name === legacyName,
    );
    const currentRows = history.rows.filter(
      (row) => row.migration_name === currentName,
    );
    const legacy = legacyRows.find(
      (row) => row.finished_at && !row.rolled_back_at,
    );
    const current = currentRows.find(
      (row) => row.finished_at && !row.rolled_back_at,
    );
    if (legacy && current) {
      throw new Error(
        `Both legacy and current migration names exist: ${legacyName}, ${currentName}`,
      );
    }
    const applied = current ?? legacy;
    if (!applied) {
      results.push({
        legacyName,
        currentName,
        status: "NOT_APPLIED",
        rolledBackAttempts: legacyRows.length + currentRows.length,
      });
      continue;
    }
    const checksumAliasAccepted = [
      ...(migrationChecksumAliases[applied.migration_name] ?? []),
      ...(!current ? (migrationChecksumAliases[legacyName] ?? []) : []),
    ].includes(applied.checksum);
    if (applied.checksum !== sourceChecksum && !checksumAliasAccepted) {
      throw new Error(
        `Checksum mismatch for ${applied.migration_name}; refusing history reconciliation`,
      );
    }
    if (current) {
      if (applied.checksum !== sourceChecksum) {
        if (!apply) {
          results.push({
            legacyName,
            currentName,
            status: "CHECKSUM_NORMALIZATION_REQUIRED",
          });
          continue;
        }
        await client.query(
          `UPDATE "_prisma_migrations"
              SET checksum = $1
            WHERE migration_name = $2
              AND checksum = $3
              AND finished_at IS NOT NULL
              AND rolled_back_at IS NULL`,
          [sourceChecksum, currentName, applied.checksum],
        );
        results.push({
          legacyName,
          currentName,
          status: "CHECKSUM_NORMALIZED",
          previousChecksum: applied.checksum,
        });
        continue;
      }
      results.push({
        legacyName,
        currentName,
        status: "ALREADY_CURRENT",
        rolledBackAttempts: currentRows.length - 1,
      });
      continue;
    }
    if (!apply) {
      results.push({ legacyName, currentName, status: "RENAME_REQUIRED" });
      continue;
    }
    await client.query(
      `UPDATE "_prisma_migrations"
          SET migration_name = $1,
              checksum = $2
        WHERE migration_name = $3`,
      [currentName, sourceChecksum, legacyName],
    );
    results.push({
      legacyName,
      currentName,
      status: "RENAMED",
      historyRows: legacyRows.length,
    });
  }
  if (apply) await client.query("COMMIT");
  else await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(
  JSON.stringify({ mode: apply ? "apply" : "check", results }, null, 2),
);
if (
  !apply &&
  results.some((entry) =>
    ["RENAME_REQUIRED", "CHECKSUM_NORMALIZATION_REQUIRED"].includes(
      entry.status,
    ),
  )
) {
  process.exitCode = 2;
}
