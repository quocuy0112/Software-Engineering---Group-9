import { access, constants } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const check = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${message}`);
  if (!condition) failures.push(message);
};
const run = (command, args) =>
  command === "npm" && process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
        cwd: root,
        encoding: "utf8",
      })
    : spawnSync(command, args, { cwd: root, encoding: "utf8" });
const canAccess = (path, mode = constants.F_OK) =>
  new Promise((done) =>
    access(resolve(root, path), mode, (error) => done(!error)),
  );
check(
  /^24[.]18[.]/.test(process.versions.node),
  `Node.js 24.18.x (found ${process.versions.node})`,
);
const npmVersion = run("npm", ["--version"]);
check(
  npmVersion.status === 0 && /^11[.]16[.]/.test(npmVersion.stdout.trim()),
  "npm 11.16.x",
);
check(run("docker", ["--version"]).status === 0, "Docker CLI");
check(run("docker", ["compose", "version"]).status === 0, "Docker Compose");
check(
  run("docker", ["compose", "config", "--quiet"]).status === 0,
  "Compose configuration",
);
check(
  run("docker", ["compose", "exec", "-T", "postgres", "pg_isready"]).status ===
    0,
  "Compose PostgreSQL health",
);
check(await canAccess(".env"), "root .env exists");
check(await canAccess("web/.env.local"), "web/.env.local exists");
check(
  await canAccess("web/.local/mail", constants.W_OK),
  "email capture directory is writable",
);
const lockfiles = (await readdir(root, { recursive: true })).filter(
  (path) =>
    !path.includes("node_modules") && path.endsWith("package-lock.json"),
);
check(
  lockfiles.length === 1 && lockfiles[0] === "package-lock.json",
  "exactly one root package-lock.json",
);
const workspaces = run("npm", ["query", ".workspace"]);
check(
  workspaces.status === 0 && workspaces.stdout.includes("@smarthire/web"),
  "@smarthire/web workspace discovery",
);
if (await canAccess("web/.env.local")) {
  const appEnvironment = Object.fromEntries(
    (await readFile(resolve(root, "web/.env.local"), "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  const adapter = appEnvironment.EMAIL_ADAPTER;
  const trustedProxyHops = Number(
    appEnvironment.AUDIT_TRUSTED_PROXY_HOPS,
  );
  const trustedProxyHopsValid =
    /^\d+$/.test(appEnvironment.AUDIT_TRUSTED_PROXY_HOPS ?? "") &&
    Number.isSafeInteger(trustedProxyHops) &&
    trustedProxyHops >= 0 &&
    trustedProxyHops <= 10 &&
    (appEnvironment.APP_ENV !== "production" || trustedProxyHops >= 1);
  check(
    trustedProxyHopsValid,
    "non-public AUDIT_TRUSTED_PROXY_HOPS is an integer from 0 to 10 and production uses at least 1",
  );
  check(
    !Object.keys(appEnvironment).some((key) =>
      key.startsWith("NEXT_PUBLIC_AUDIT_"),
    ),
    "audit proxy configuration is not browser-public",
  );
  let emailValid = ["capture", "resend", "smtp"].includes(adapter);
  if (adapter === "smtp") {
    const port = Number(appEnvironment.SMTP_PORT);
    const secure = appEnvironment.SMTP_SECURE === "true";
    const useTls = appEnvironment.SMTP_USE_TLS === "true";
    const sender = appEnvironment.SMTP_FROM?.replace(/^"|"$/g, "") ?? "";
    emailValid &&= Boolean(
      appEnvironment.SMTP_HOST &&
      appEnvironment.SMTP_USERNAME &&
      appEnvironment.SMTP_PASSWORD &&
      port >= 1 &&
      port <= 65535 &&
      /<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$|^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(
        sender,
      ),
    );
    if (
      appEnvironment.SMTP_HOST?.toLowerCase() === "smtp.gmail.com" &&
      port === 587
    )
      emailValid &&= !secure && useTls;
    if (
      appEnvironment.SMTP_HOST?.toLowerCase() === "smtp.gmail.com" &&
      port === 465
    )
      emailValid &&= secure;
  }
  check(emailValid, "server-only email adapter configuration");
  const prismaCli = resolve(root, "node_modules/prisma/build/index.js");
  const connectivity = spawnSync(
    process.execPath,
    [prismaCli, "db", "execute", "--stdin"],
    {
      cwd: resolve(root, "web"),
      env: { ...process.env, ...appEnvironment },
      input: "SELECT 1;",
      encoding: "utf8",
    },
  );
  check(
    connectivity.status === 0,
    "Prisma connects through generated DATABASE_URL/DIRECT_URL",
  );
}
if (failures.length) {
  console.error(`Environment check failed (${failures.length} checks).`);
  process.exit(1);
}
console.log("Environment check passed; no secret values were displayed.");
