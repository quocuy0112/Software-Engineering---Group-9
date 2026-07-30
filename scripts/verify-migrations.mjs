import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const databaseUrl = new URL(appEnv.DIRECT_URL);
const shadowUrl = new URL(appEnv.DIRECT_URL);
databaseUrl.pathname = `/${verifyDatabase}`;
shadowUrl.pathname = `/${shadowDatabase}`;
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  DIRECT_URL: databaseUrl.toString(),
  SHADOW_DATABASE_URL: shadowUrl.toString(),
};

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
function prisma(args, input) {
  return run(process.execPath, [prismaCli, ...args], {
    cwd: app,
    env: environment,
    input,
  });
}

compose(["config", "--quiet"]);
databaseTool("pg_isready", "-d", composeEnv.POSTGRES_DB);
for (const database of [verifyDatabase, shadowDatabase])
  databaseTool("dropdb", "--if-exists", database);
try {
  databaseTool("createdb", verifyDatabase);
  databaseTool("createdb", shadowDatabase);
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
} finally {
  for (const database of [verifyDatabase, shadowDatabase]) {
    try {
      databaseTool("dropdb", "--if-exists", database);
    } catch {
      console.error(`Could not remove temporary database ${database}.`);
    }
  }
}
