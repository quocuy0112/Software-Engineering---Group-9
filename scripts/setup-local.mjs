import { randomBytes } from "node:crypto";
import { access, constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exists = (path) =>
  new Promise((done) => access(path, constants.F_OK, (error) => done(!error)));
const run = (command, args) =>
  spawnSync(command, args, { cwd: root, encoding: "utf8" });
const parseEnvironment = (contents) =>
  Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
const readEnvironmentIfPresent = async (path) =>
  (await exists(path)) ? parseEnvironment(await readFile(path, "utf8")) : {};
const isPathWithin = (parent, candidate) => {
  const child = relative(parent, candidate);
  return child.length > 0 && !child.startsWith("..") && !isAbsolute(child);
};
const inspectPrivateDirectory = async (path) => {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("Local CV artifact paths must be real directories.");
  }
  if (
    process.platform !== "win32" &&
    typeof process.getuid === "function" &&
    metadata.uid !== process.getuid()
  ) {
    throw new Error(
      "Local CV artifact paths must be owned by this process user.",
    );
  }
  await chmod(path, 0o700);
};
const provisionCvStorageRoot = async (webRoot, storageRoot) => {
  const localRoot = resolve(webRoot, ".local");
  const realWebRoot = await realpath(webRoot);

  if (await exists(localRoot)) await inspectPrivateDirectory(localRoot);
  else await mkdir(localRoot, { mode: 0o700 });

  if (await exists(storageRoot)) await inspectPrivateDirectory(storageRoot);
  else await mkdir(storageRoot, { mode: 0o700 });

  const realStorageRoot = await realpath(storageRoot);
  if (!isPathWithin(realWebRoot, realStorageRoot)) {
    throw new Error(
      "Local CV artifact root escaped the application directory.",
    );
  }
};
const ensureEnvDefaults = async (path, defaults) => {
  const contents = await readFile(path, "utf8");
  const additions = defaults.filter(
    ([key]) => !new RegExp(`^${key}=`, "m").test(contents),
  );
  if (additions.length === 0) return [];

  const separator =
    contents.length === 0 || contents.endsWith("\n") ? "" : "\n";
  const appended = additions
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(path, `${contents}${separator}${appended}\n`, {
    mode: 0o600,
  });
  return additions.map(([key]) => key);
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
const rootEnvironmentPath = resolve(root, ".env");
const webEnvironmentPath = resolve(root, "web/.env.local");
const existingRootEnvironment =
  await readEnvironmentIfPresent(rootEnvironmentPath);
const existingWebEnvironment =
  await readEnvironmentIfPresent(webEnvironmentPath);
if (
  existingRootEnvironment.CV_ARTIFACT_KEY_V1 &&
  existingWebEnvironment.CV_ARTIFACT_KEY_V1 &&
  existingRootEnvironment.CV_ARTIFACT_KEY_V1 !==
    existingWebEnvironment.CV_ARTIFACT_KEY_V1
) {
  throw new Error(
    "Existing root and web CV artifact keys disagree; resolve them without printing either value.",
  );
}
const cvArtifactKey =
  existingWebEnvironment.CV_ARTIFACT_KEY_V1 ??
  existingRootEnvironment.CV_ARTIFACT_KEY_V1 ??
  randomBytes(32).toString("base64");
const cvStorageRoot = resolve(root, "web/.local/cv-storage");
const cvDefaults = [
  ["CV_STORAGE_ADAPTER", "filesystem"],
  ["CV_STORAGE_LOCAL_ROOT", cvStorageRoot],
  ["CV_ARTIFACT_ACTIVE_KEY_VERSION", "1"],
  ["CV_ARTIFACT_KEY_V1", cvArtifactKey],
  ["CV_S3_BUCKET", ""],
  ["CV_S3_REGION", ""],
  ["CV_S3_KMS_KEY_ID", ""],
  ["CV_CLAMD_SOCKET_PATH", "/run/clamav/clamd.sock"],
  ["CV_CLAMD_SIGNATURE_MAX_AGE_HOURS", "24"],
  ["CV_PARSER_ADAPTER", "deterministic"],
  ["CV_OPENAI_ENABLED", "false"],
  ["CV_OPENAI_LOCAL_DEV_ENABLED", "false"],
  ["OPENAI_API_KEY", ""],
  ["CV_OPENAI_MODEL", "gpt-5.4-mini-2026-03-17"],
  ["CV_OPENAI_DPA_APPROVED", "false"],
  ["CV_OPENAI_CROSS_BORDER_APPROVED", "false"],
  ["CV_OPENAI_ZDR_APPROVED", "false"],
  ["CV_WORKER_ENABLED", "true"],
  ["CV_CLEANUP_ENABLED", "true"],
  ["CV_SOURCE_MAX_BYTES", "5000000"],
  ["CV_UPLOAD_ATTEMPTS_PER_HOUR", "5"],
  ["CV_ACCOUNT_MAX_IMPORTS", "10"],
  ["CV_ACCOUNT_MAX_STORAGE_BYTES", "52428800"],
  ["CV_REJECTED_RETENTION_HOURS", "24"],
  ["CV_UNCONFIRMED_RETENTION_DAYS", "30"],
  ["CV_CONFIRMED_RETENTION_DAYS", "7"],
  ["CV_CANDIDATE_DELETE_RETENTION_HOURS", "24"],
];
const renderDefaults = (defaults) =>
  defaults.map(([key, value]) => `${key}=${value}`).join("\n");
const files = [
  [
    ".env",
    `POSTGRES_DB=smarthire\nPOSTGRES_USER=smarthire\nPOSTGRES_PASSWORD=${databasePassword}\nPOSTGRES_PORT=55432\nAUDIT_TRUSTED_PROXY_HOPS=0\n${renderDefaults(cvDefaults)}\n`,
  ],
  [
    "web/.env.local",
    `APP_ENV=local\nNEXT_PUBLIC_APP_URL=http://localhost:3001\nDATABASE_URL=${databaseUrl}\nDIRECT_URL=${databaseUrl}\nBETTER_AUTH_URL=http://localhost:3001\nBETTER_AUTH_SECRET=${authSecret}\nTOKEN_SECRET=${tokenSecret}\nAUDIT_TRUSTED_PROXY_HOPS=0\nAUTH_COOKIE_ENV=local\nEMAIL_ADAPTER=capture\nEMAIL_CAPTURE_DIRECTORY=.local/mail\nEMAIL_CAPTURE_DIR=.local/mail\nRESEND_API_KEY=\nEMAIL_FROM=\nSMTP_HOST=\nSMTP_PORT=\nSMTP_USERNAME=\nSMTP_PASSWORD=\nSMTP_FROM=\nSMTP_SECURE=\nSMTP_USE_TLS=\nSESSION_COOKIE_NAME=smarthire.session\nPRE_AUTH_COOKIE_NAME=smarthire.pre-auth\nCOOKIE_SECURE=false\nCOOKIE_SAME_SITE=lax\n${renderDefaults(cvDefaults)}\n`,
  ],
];
for (const [relativePath, contents] of files) {
  const path = resolve(root, relativePath);
  if (await exists(path)) {
    const addedKeys = await ensureEnvDefaults(path, [
      ["AUDIT_TRUSTED_PROXY_HOPS", "0"],
      ...cvDefaults,
    ]);
    console.log(
      addedKeys.length > 0
        ? `Added ${addedKeys.length} missing protected/default settings to existing ${relativePath}`
        : `Preserved existing ${relativePath}`,
    );
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { flag: "wx", mode: 0o600 });
    console.log(`Created ${relativePath}`);
  }
}
await provisionCvStorageRoot(resolve(root, "web"), cvStorageRoot);
await mkdir(resolve(root, "web/.local/mail"), { recursive: true });
console.log("Local email capture directory is ready.");
console.log(
  "Private local CV artifact directory is ready; only encrypted artifacts belong there and retention cleanup owns their removal.",
);
