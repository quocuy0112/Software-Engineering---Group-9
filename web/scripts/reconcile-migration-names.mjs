import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";
import {
  migrationChecksumAliases,
  migrationHistoryMergeGroups,
  migrationNameMap,
  obsoleteMigrationNames,
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

function rowsFor(history, name) {
  return history.filter((row) => row.migration_name === name);
}

function assertNoInProgress(rows) {
  const inProgress = rows.filter(
    (row) => !row.finished_at && !row.rolled_back_at,
  );
  if (inProgress.length) {
    throw new Error(
      `Migration history contains an unfinished row: ${inProgress
        .map((row) => row.migration_name)
        .join(", ")}`,
    );
  }
}

function assertChecksums(rows, accepted, name) {
  const invalid = rows.filter((row) => !accepted.has(row.checksum));
  if (invalid.length) {
    throw new Error(
      `Checksum mismatch for ${name}: ${invalid
        .map((row) => `${row.migration_name}=${row.checksum}`)
        .join(", ")}`,
    );
  }
}

const sourceChecksums = new Map();
async function sourceChecksumVariants(name) {
  if (!sourceChecksums.has(name)) {
    const sql = await readFile(
      resolve(webRoot, "prisma/migrations", name, "migration.sql"),
    );
    const text = sql.toString("utf8");
    sourceChecksums.set(
      name,
      new Set([
        checksum(sql),
        checksum(Buffer.from(text.replace(/\r\n/g, "\n"))),
      ]),
    );
  }
  return sourceChecksums.get(name);
}

async function sourceChecksum(name) {
  return [...(await sourceChecksumVariants(name))][0];
}

async function acceptedChecksums(sourceName, extraNames = []) {
  return new Set([
    ...(await sourceChecksumVariants(sourceName)),
    ...(migrationChecksumAliases[sourceName] ?? []),
    ...extraNames.flatMap((aliasName) =>
      migrationChecksumAliases[aliasName] ?? [],
    ),
  ]);
}

const mergeNames = migrationHistoryMergeGroups.flatMap((group) => [
  group.currentName,
  ...group.legacyNames,
]);
const mappedNames = migrationNameMap.flatMap(([legacyName, currentName]) => [
  legacyName,
  currentName,
]);
const historyNames = [
  ...new Set([...mergeNames, ...mappedNames, ...obsoleteMigrationNames]),
];

await client.connect();
try {
  await client.query("BEGIN");
  const historyResult = await client.query(
    `SELECT id, migration_name, checksum, finished_at, rolled_back_at
       FROM "_prisma_migrations"
      WHERE migration_name = ANY($1::text[])
      ORDER BY started_at, id
      FOR UPDATE`,
    [historyNames],
  );
  const history = historyResult.rows;
  const renameOperations = [];
  const deleteIds = new Set();
  const normalizeOperations = [];

  for (const group of migrationHistoryMergeGroups) {
    const targetRows = rowsFor(history, group.currentName);
    const legacyRows = group.legacyNames.flatMap((name) =>
      rowsFor(history, name),
    );
    [...targetRows, ...legacyRows].forEach((row) => assertNoInProgress([row]));

    const targetChecksum = await sourceChecksum(group.currentName);
    const acceptedTargetChecksums = await acceptedChecksums(
      group.currentName,
      group.legacyNames,
    );
    assertChecksums(targetRows, acceptedTargetChecksums, group.currentName);
    for (const legacyName of group.legacyNames) {
      assertChecksums(
        rowsFor(history, legacyName),
        new Set([
          ...(migrationChecksumAliases[legacyName] ?? []),
          ...(await sourceChecksumVariants(group.currentName)),
          ...(migrationChecksumAliases[group.currentName] ?? []),
        ]),
        legacyName,
      );
    }

    if (targetRows.length > 1) {
      throw new Error(
        `Multiple current rows exist for merged migration ${group.currentName}`,
      );
    }
    if (targetRows.length && legacyRows.length) {
      throw new Error(
        `Both current and legacy rows exist for merged migration ${group.currentName}`,
      );
    }

    if (targetRows.length) {
      const target = targetRows[0];
      if (target.checksum !== targetChecksum) {
        normalizeOperations.push({
          id: target.id,
          migrationName: group.currentName,
          checksum: targetChecksum,
        });
      }
      results.push({
        currentName: group.currentName,
        status: "ALREADY_CURRENT",
      });
      continue;
    }

    if (!legacyRows.length) {
      results.push({
        currentName: group.currentName,
        status: "NOT_APPLIED",
      });
      continue;
    }

    const presentLegacyNames = new Set(
      legacyRows.map((row) => row.migration_name),
    );
    const completeSet = group.completeLegacySets.find((set) =>
      set.every((name) => presentLegacyNames.has(name)),
    );
    if (!completeSet) {
      throw new Error(
        `Incomplete legacy history for ${group.currentName}; found ${[
          ...presentLegacyNames,
        ].join(", ")}`,
      );
    }

    const keeper = legacyRows.find((row) =>
      completeSet.includes(row.migration_name),
    );
    renameOperations.push({
      id: keeper.id,
      legacyName: keeper.migration_name,
      migrationName: group.currentName,
      checksum: targetChecksum,
    });
    for (const row of legacyRows) {
      if (row.id !== keeper.id) deleteIds.add(row.id);
    }
    results.push({
      currentName: group.currentName,
      status: "MERGE_REQUIRED",
      legacyNames: [...presentLegacyNames],
    });
  }

  for (const [legacyName, currentName] of migrationNameMap) {
    if (legacyName === currentName) continue;

    const legacyRows = rowsFor(history, legacyName);
    const currentRows = rowsFor(history, currentName);
    [...legacyRows, ...currentRows].forEach((row) => assertNoInProgress([row]));
    const currentChecksum = await sourceChecksum(currentName);

    if (legacyRows.length && currentRows.length) {
      throw new Error(
        `Both legacy and current migration names exist: ${legacyName}, ${currentName}`,
      );
    }
    if (legacyRows.length) {
      assertChecksums(
        legacyRows,
        await acceptedChecksums(currentName, [legacyName]),
        legacyName,
      );
      for (const row of legacyRows) {
        renameOperations.push({
          id: row.id,
          legacyName,
          migrationName: currentName,
          checksum: currentChecksum,
        });
      }
      results.push({
        legacyName,
        currentName,
        status: "RENAME_REQUIRED",
        historyRows: legacyRows.length,
      });
      continue;
    }
    if (currentRows.length) {
      assertChecksums(
        currentRows,
        await acceptedChecksums(currentName, [legacyName]),
        currentName,
      );
      for (const row of currentRows) {
        if (row.checksum !== currentChecksum) {
          normalizeOperations.push({
            id: row.id,
            migrationName: currentName,
            checksum: currentChecksum,
          });
        }
      }
      results.push({
        legacyName,
        currentName,
        status: "ALREADY_CURRENT",
      });
      continue;
    }
    results.push({ legacyName, currentName, status: "NOT_APPLIED" });
  }

  for (const obsoleteName of obsoleteMigrationNames) {
    const obsoleteRows = rowsFor(history, obsoleteName);
    obsoleteRows.forEach((row) => assertNoInProgress([row]));
    if (obsoleteRows.length) {
      const aliases = migrationChecksumAliases[obsoleteName] ?? [];
      assertChecksums(obsoleteRows, new Set(aliases), obsoleteName);
      obsoleteRows.forEach((row) => deleteIds.add(row.id));
      results.push({
        obsoleteName,
        status: "REMOVE_REQUIRED",
        historyRows: obsoleteRows.length,
      });
    } else {
      results.push({ obsoleteName, status: "NOT_APPLIED" });
    }
  }

  if (apply) {
    for (const operation of renameOperations) {
      await client.query(
        `UPDATE "_prisma_migrations"
            SET migration_name = $1
          WHERE id = $2`,
        [`__codex_renumber__${operation.id}`, operation.id],
      );
    }
    if (deleteIds.size) {
      await client.query(
        `DELETE FROM "_prisma_migrations"
          WHERE id = ANY($1::text[])`,
        [[...deleteIds]],
      );
    }
    for (const operation of renameOperations) {
      await client.query(
        `UPDATE "_prisma_migrations"
            SET migration_name = $1,
                checksum = $2
          WHERE id = $3`,
        [operation.migrationName, operation.checksum, operation.id],
      );
    }
    for (const operation of normalizeOperations) {
      await client.query(
        `UPDATE "_prisma_migrations"
            SET checksum = $1
          WHERE id = $2`,
        [operation.checksum, operation.id],
      );
    }
    await client.query("COMMIT");
  } else {
    await client.query("ROLLBACK");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(JSON.stringify({ mode: apply ? "apply" : "check", results }, null, 2));
if (
  !apply &&
  results.some((entry) =>
    ["RENAME_REQUIRED", "REMOVE_REQUIRED", "MERGE_REQUIRED"].includes(
      entry.status,
    ),
  )
) {
  process.exitCode = 2;
}
