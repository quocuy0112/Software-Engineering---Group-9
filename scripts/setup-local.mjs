import { randomBytes } from "node:crypto";
import { access, constants } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exists = (path) =>
  new Promise((done) => access(path, constants.F_OK, (error) => done(!error)));
const run = (command, args) =>
  spawnSync(command, args, { cwd: root, encoding: "utf8" });
const ensureEnvDefault = async (path, key, value) => {
  const contents = await readFile(path, "utf8");
  if (new RegExp(`^${key}=`, "m").test(contents)) return false;

  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${contents}${separator}${key}=${value}\n`, {
    mode: 0o600,
  });
  return true;
};
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Node.js 24 is required.");
if (run("docker", ["--version"]).status !== 0)
  throw new Error("Docker is required.");
if (run("docker", ["compose", "version"]).status !== 0)
  throw new Error("Docker Compose is required.");
const databasePassword = randomBytes(36).toString("base64url");
const authSecret = randomBytes(48).toString("base64url");
const tokenSecret = randomBytes(48).toString("base64url");
const databaseUrl = `postgresql://smarthire:${encodeURIComponent(databasePassword)}@localhost:55432/smarthire?schema=public`;
const files = [
  [
    ".env",
    `POSTGRES_DB=smarthire\nPOSTGRES_USER=smarthire\nPOSTGRES_PASSWORD=${databasePassword}\nPOSTGRES_PORT=55432\nAUDIT_TRUSTED_PROXY_HOPS=0\n`,
  ],
  [
    "web/.env.local",
    `APP_ENV=local\nNEXT_PUBLIC_APP_URL=http://localhost:3001\nDATABASE_URL=${databaseUrl}\nDIRECT_URL=${databaseUrl}\nBETTER_AUTH_URL=http://localhost:3001\nBETTER_AUTH_SECRET=${authSecret}\nTOKEN_SECRET=${tokenSecret}\nAUDIT_TRUSTED_PROXY_HOPS=0\nAUTH_COOKIE_ENV=local\nEMAIL_ADAPTER=capture\nEMAIL_CAPTURE_DIRECTORY=.local/mail\nEMAIL_CAPTURE_DIR=.local/mail\nRESEND_API_KEY=\nEMAIL_FROM=\nSMTP_HOST=\nSMTP_PORT=\nSMTP_USERNAME=\nSMTP_PASSWORD=\nSMTP_FROM=\nSMTP_SECURE=\nSMTP_USE_TLS=\nSESSION_COOKIE_NAME=smarthire.session\nPRE_AUTH_COOKIE_NAME=smarthire.pre-auth\nCOOKIE_SECURE=false\nCOOKIE_SAME_SITE=lax\n`,
  ],
];
for (const [relativePath, contents] of files) {
  const path = resolve(root, relativePath);
  if (await exists(path)) {
    const updated = await ensureEnvDefault(
      path,
      "AUDIT_TRUSTED_PROXY_HOPS",
      "0",
    );
    console.log(
      updated
        ? `Added AUDIT_TRUSTED_PROXY_HOPS to existing ${relativePath}`
        : `Preserved existing ${relativePath}`,
    );
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { flag: "wx", mode: 0o600 });
    console.log(`Created ${relativePath}`);
  }
}
await mkdir(resolve(root, "web/.local/mail"), { recursive: true });
console.log("Local email capture directory is ready.");
