import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(root, "web");
const prismaCli = resolve(root, "node_modules/prisma/build/index.js");
const composeEnv = Object.fromEntries(
  (await readFile(resolve(root, ".env"), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/=(.*)/s).slice(0, 2)),
);
const appEnv = Object.fromEntries(
  (await readFile(resolve(app, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/=(.*)/s).slice(0, 2)),
);
const verifyDatabase = "smarthire_migration_verify";
const shadowDatabase = "smarthire_migration_shadow";
const upgradeDatabase = "smarthire_migration_upgrade_verify";
const baselineMigrations = [
  "001_identity_foundation",
  "002_email_outbox_worker",
  "003_totp_challenge_replay",
  "004_password_reset_recovery_operations",
  "005_full_account_recovery",
  "006_add_two_factor_lockout_fields",
];

function databaseUrlFor(database) {
  const url = new URL(appEnv.DIRECT_URL);
  url.pathname = `/${database}`;
  return url;
}

function databaseEnvironment(database) {
  const databaseUrl = databaseUrlFor(database);
  return {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
    DIRECT_URL: databaseUrl.toString(),
    SHADOW_DATABASE_URL: databaseUrlFor(shadowDatabase).toString(),
  };
}

const environment = databaseEnvironment(verifyDatabase);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
  });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function compose(args) {
  return run("docker", ["compose", ...args]);
}
function databaseTool(tool, ...args) {
  compose([
    "exec",
    "-T",
    "postgres",
    tool,
    "-U",
    composeEnv.POSTGRES_USER,
    ...args,
  ]);
}
function prisma(args, input, targetEnvironment = environment) {
  return run(process.execPath, [prismaCli, ...args], {
    cwd: app,
    env: targetEnvironment,
    input,
  });
}

async function expectConstraintRejection(client, statement, constraint) {
  await client.query("BEGIN");
  let rejected = false;
  try {
    await client.query(statement);
  } catch (error) {
    rejected = true;
    if (error?.constraint !== constraint) {
      throw new Error(
        `Expected ${constraint}, received ${error?.constraint ?? "an unknown database error"}.`,
      );
    }
  } finally {
    await client.query("ROLLBACK");
  }
  if (!rejected) throw new Error(`Expected database constraint ${constraint}.`);
}

async function verifyFeatureOneUpgrade() {
  const upgradeEnvironment = databaseEnvironment(upgradeDatabase);
  for (const migration of baselineMigrations) {
    const sql = await readFile(
      resolve(app, "prisma/migrations", migration, "migration.sql"),
      "utf8",
    );
    prisma(["db", "execute", "--stdin"], sql, upgradeEnvironment);
    prisma(
      ["migrate", "resolve", "--applied", migration],
      undefined,
      upgradeEnvironment,
    );
  }

  prisma(
    ["db", "execute", "--stdin"],
    `INSERT INTO "user" (
       "id", "name", "email", "normalizedEmail", "emailVerified", "state",
       "updatedAt"
     ) VALUES
       (
         'upgrade_user_1', 'Upgrade Candidate One',
         'upgrade-one@example.test', 'upgrade-one@example.test', true,
         'ACTIVE', CURRENT_TIMESTAMP
       ),
       (
         'upgrade_user_2', 'Upgrade Candidate Two',
         'upgrade-two@example.test', 'upgrade-two@example.test', true,
         'ACTIVE', CURRENT_TIMESTAMP
       );
     INSERT INTO "CandidateIdentity" ("userId", "updatedAt") VALUES
       ('upgrade_user_1', CURRENT_TIMESTAMP),
       ('upgrade_user_2', CURRENT_TIMESTAMP);`,
    upgradeEnvironment,
  );

  prisma(["migrate", "deploy"], undefined, upgradeEnvironment);
  prisma(["migrate", "status"], undefined, upgradeEnvironment);
  prisma(
    [
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-config-datasource",
      "--exit-code",
    ],
    undefined,
    upgradeEnvironment,
  );

  const client = new Client({
    connectionString: databaseUrlFor(upgradeDatabase).toString(),
  });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM "CandidateIdentity") AS identity_count,
         (SELECT COUNT(*) FROM "CandidateProfile") AS profile_count,
         (
           SELECT COUNT(*)
           FROM "CandidateIdentity" AS identity
           LEFT JOIN "CandidateProfile" AS profile
             ON profile."candidateUserId" = identity."userId"
           WHERE profile."id" IS NULL
         ) AS missing_profile_count`,
    );
    const counts = result.rows[0];
    if (
      Number(counts.identity_count) !== 2 ||
      Number(counts.profile_count) !== 2 ||
      Number(counts.missing_profile_count) !== 0
    ) {
      throw new Error("Feature 001 candidate-profile backfill counts differ.");
    }

    await expectConstraintRejection(
      client,
      `INSERT INTO "AccountPreferences" (
         "userId", "accountSecurityEmail", "updatedAt"
       ) VALUES ('upgrade_user_1', false, CURRENT_TIMESTAMP)`,
      "account_preferences_security_mail_required",
    );
  } finally {
    await client.end();
  }

  console.log(
    "Feature 001 upgrade, profile backfill, drift, and constraint verification passed.",
  );
}

compose(["config", "--quiet"]);
databaseTool("pg_isready", "-d", composeEnv.POSTGRES_DB);
for (const database of [verifyDatabase, shadowDatabase, upgradeDatabase])
  databaseTool("dropdb", "--if-exists", database);
try {
  databaseTool("createdb", verifyDatabase);
  databaseTool("createdb", shadowDatabase);
  databaseTool("createdb", upgradeDatabase);
  prisma(["migrate", "deploy"]);
  prisma(["migrate", "status"]);
  prisma([
    "migrate",
    "diff",
    "--from-migrations",
    "prisma/migrations",
    "--to-config-datasource",
    "--exit-code",
  ]);
  prisma(["db", "execute", "--stdin"], "SELECT 1;");
  console.log(
    "Fresh migration, drift, and Prisma connectivity verification passed.",
  );
  await verifyFeatureOneUpgrade();
} finally {
  for (const database of [verifyDatabase, shadowDatabase, upgradeDatabase]) {
    try {
      databaseTool("dropdb", "--if-exists", database);
    } catch {
      console.error(`Could not remove temporary database ${database}.`);
    }
  }
}
