import { access, constants } from "node:fs";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
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
const readEnvironment = async (path) =>
  Object.fromEntries(
    (await readFile(resolve(root, path), "utf8"))
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
const isStrictBoolean = (value) => value === "true" || value === "false";
const isPathWithin = (parent, candidate) => {
  const child = relative(parent, candidate);
  return child.length > 0 && !child.startsWith("..") && !isAbsolute(child);
};
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
// This check is intentionally limited to the repository root.  A recursive
// scan visits ignored tool caches (for example .pytest_cache), which can be
// temporarily locked on Windows and are irrelevant to the root lockfile.
const lockfiles = (await readdir(root)).filter(
  (path) => path === "package-lock.json",
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
  const appEnvironment = await readEnvironment("web/.env.local");
  const rootEnvironment = (await canAccess(".env"))
    ? await readEnvironment(".env")
    : {};
  const adapter = appEnvironment.EMAIL_ADAPTER;
  const trustedProxyHops = Number(appEnvironment.AUDIT_TRUSTED_PROXY_HOPS);
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

  const combinedEnvironment = { ...rootEnvironment, ...appEnvironment };
  const forbiddenScannerOrProviderKeys = Object.keys(
    combinedEnvironment,
  ).filter(
    (key) =>
      /^CV_CLAMD_(?:HOST|PORT|TCP|ADDR|ADDRESS)$/i.test(key) ||
      /^(?:CV_OPENAI_(?:BASE_URL|ENDPOINT)|OPENAI_BASE_URL)$/i.test(key),
  );
  check(
    forbiddenScannerOrProviderKeys.length === 0,
    "no scanner host/port/TCP or custom OpenAI endpoint configuration",
  );
  const forbiddenOcrOrSearchKeys = Object.keys(combinedEnvironment).filter(
    (key) =>
      /^NEXT_PUBLIC_(?:OCR|IMAGE_SEARCH)_/i.test(key) ||
      /^OCR_ENGINE_(?:URL|HOST|PORT|TCP|ADDRESS)$/i.test(key) ||
      /^(?:IMAGE_SEARCH_OPENAI_(?:BASE_URL|ENDPOINT)|OPENAI_BASE_URL)$/i.test(
        key,
      ),
  );
  check(
    forbiddenOcrOrSearchKeys.length === 0,
    "OCR/search configuration is server-only with no TCP or custom provider endpoint",
  );
  check(
    isStrictBoolean(appEnvironment.OCR_ENGINE_ENABLED) &&
      appEnvironment.OCR_ENGINE_SOCKET_PATH === "/run/smarthire-ocr/ocr.sock" &&
      isAbsolute(appEnvironment.OCR_ENGINE_SOCKET_PATH),
    "OCR uses only the fixed absolute private Unix socket",
  );
  check(
    appEnvironment.OCR_ENGINE_NAME === "paddleocr-onnx" &&
      appEnvironment.OCR_ENGINE_VERSION === "1.0.0" &&
      appEnvironment.OCR_MODEL_NAME === "PP-OCRv6-medium" &&
      appEnvironment.OCR_MODEL_SHA256 ===
        "4a7ec9635845d44fd6c6fb323386ee526282b8de566358fe646d711b5992e505" &&
      appEnvironment.OCR_POLICY_VERSION === "ocr-confidence-v1",
    "OCR engine, model manifest, and policy pins are immutable",
  );
  check(
    appEnvironment.OCR_CV_UNIT_TIMEOUT_SECONDS === "20" &&
      appEnvironment.CV_HYBRID_DEADLINE_SECONDS === "180" &&
      appEnvironment.OCR_SEARCH_TIMEOUT_SECONDS === "6",
    "OCR deadlines are exactly 20-second CV, 180-second hybrid, and 6-second search",
  );

  const decode32ByteKey = (key) => {
    const encoded = appEnvironment[key] ?? "";
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0)
      return Buffer.alloc(0);
    return Buffer.from(encoded, "base64");
  };
  const imageSearchKeyNames = [
    "IMAGE_SEARCH_ARTIFACT_KEY_V1",
    "IMAGE_SEARCH_RATE_HMAC_KEY_V1",
    "IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1",
  ];
  const imageSearchKeys = imageSearchKeyNames.map(decode32ByteKey);
  check(
    appEnvironment.IMAGE_SEARCH_ARTIFACT_ACTIVE_KEY_VERSION === "1" &&
      imageSearchKeys.every((key) => key.length === 32) &&
      new Set([
        appEnvironment.CV_ARTIFACT_KEY_V1,
        ...imageSearchKeyNames.map((key) => appEnvironment[key]),
      ]).size === 4,
    "CV, search artifact, rate, and capability key material is valid and purpose-separated",
  );
  const fixedSearchSettings = {
    IMAGE_SEARCH_SOURCE_MAX_BYTES: "5000000",
    IMAGE_SEARCH_MAX_DECODED_PIXELS: "20000000",
    IMAGE_SEARCH_VISITOR_LIMIT_PER_HOUR: "3",
    IMAGE_SEARCH_ACCOUNT_LIMIT_PER_HOUR: "10",
    IMAGE_SEARCH_RETENTION_MINUTES: "15",
  };
  check(
    Object.entries(fixedSearchSettings).every(
      ([key, expected]) => appEnvironment[key] === expected,
    ),
    "image-search byte, pixel, quota, and retention constants match the reviewed policy",
  );
  check(
    isStrictBoolean(appEnvironment.IMAGE_SEARCH_WORKER_ENABLED) &&
      appEnvironment.IMAGE_SEARCH_CLEANUP_ENABLED === "true",
    "image-search worker flag is explicit and cleanup remains enabled",
  );
  check(
    [
      "IMAGE_SEARCH_OPENAI_ENABLED",
      "IMAGE_SEARCH_OPENAI_DPA_APPROVED",
      "IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED",
      "IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED",
      "IMAGE_SEARCH_OPENAI_ZDR_APPROVED",
    ].every((key) => isStrictBoolean(appEnvironment[key])),
    "image-search external processing gates use explicit booleans",
  );
  check(
    appEnvironment.IMAGE_SEARCH_OPENAI_MODEL === "gpt-5.4-mini-2026-03-17" &&
      appEnvironment.IMAGE_SEARCH_INTERPRETER === "openai" &&
      appEnvironment.IMAGE_SEARCH_OPENAI_ENABLED === "true" &&
      Boolean(appEnvironment.OPENAI_API_KEY),
    "image search uses the approved OpenAI model and shared server API key",
  );
  check(
    appEnvironment.CV_CLAMD_SOCKET_PATH === "/run/clamav/clamd.sock",
    "ClamAV uses only the fixed same-host/pod Unix socket",
  );
  check(
    appEnvironment.CV_CLAMD_SIGNATURE_MAX_AGE_HOURS === "24",
    "ClamAV signature maximum age is fixed at 24 hours",
  );
  check(
    !Object.keys(appEnvironment).some((key) =>
      key.startsWith("NEXT_PUBLIC_CV_"),
    ),
    "CV configuration and secrets are not browser-public",
  );

  const artifactKey = appEnvironment.CV_ARTIFACT_KEY_V1 ?? "";
  const artifactKeyIsBase64 =
    /^[A-Za-z0-9+/]+={0,2}$/.test(artifactKey) && artifactKey.length % 4 === 0;
  const artifactKeyBytes = artifactKeyIsBase64
    ? Buffer.from(artifactKey, "base64")
    : Buffer.alloc(0);
  check(
    appEnvironment.CV_ARTIFACT_ACTIVE_KEY_VERSION === "1" &&
      artifactKeyBytes.length === 32,
    "active CV artifact key version is 1 and key material decodes to 32 bytes",
  );

  const fixedCvSettings = {
    CV_SOURCE_MAX_BYTES: "5000000",
    CV_UPLOAD_ATTEMPTS_PER_HOUR: "5",
    CV_ACCOUNT_MAX_IMPORTS: "10",
    CV_ACCOUNT_MAX_STORAGE_BYTES: "52428800",
    CV_REJECTED_RETENTION_HOURS: "24",
    CV_UNCONFIRMED_RETENTION_DAYS: "30",
    CV_CONFIRMED_RETENTION_DAYS: "7",
    CV_CANDIDATE_DELETE_RETENTION_HOURS: "24",
  };
  check(
    Object.entries(fixedCvSettings).every(
      ([key, expected]) => appEnvironment[key] === expected,
    ),
    "Feature 004 source, quota, and retention limits match reviewed constants",
  );
  check(
    isStrictBoolean(appEnvironment.CV_WORKER_ENABLED) &&
      appEnvironment.CV_CLEANUP_ENABLED === "true",
    "CV worker setting is explicit and cleanup remains enabled",
  );
  check(
    isStrictBoolean(appEnvironment.CV_OPENAI_ENABLED) &&
      isStrictBoolean(appEnvironment.CV_OPENAI_LOCAL_DEV_ENABLED) &&
      isStrictBoolean(appEnvironment.CV_OPENAI_DPA_APPROVED) &&
      isStrictBoolean(appEnvironment.CV_OPENAI_CROSS_BORDER_APPROVED) &&
      isStrictBoolean(appEnvironment.CV_OPENAI_ZDR_APPROVED),
    "external parser deployment approvals use explicit booleans",
  );
  check(
    appEnvironment.CV_OPENAI_MODEL === "gpt-5.4-mini-2026-03-17",
    "external parser model is the reviewed immutable snapshot",
  );

  const localStorageRoot = appEnvironment.CV_STORAGE_LOCAL_ROOT ?? "";
  const resolvedLocalStorageRoot = resolve(localStorageRoot || root);
  const approvedLocalStorageParent = resolve(root, "web/.local");
  check(
    isAbsolute(localStorageRoot) &&
      isPathWithin(approvedLocalStorageParent, resolvedLocalStorageRoot),
    "local CV storage root is absolute and contained by web/.local",
  );
  let localStorageRootIsPrivate = false;
  try {
    const [parentMetadata, storageMetadata, realParent, realStorage] =
      await Promise.all([
        lstat(approvedLocalStorageParent),
        lstat(resolvedLocalStorageRoot),
        realpath(approvedLocalStorageParent),
        realpath(resolvedLocalStorageRoot),
      ]);
    const currentUserOwnsDirectories =
      process.platform === "win32" ||
      typeof process.getuid !== "function" ||
      (parentMetadata.uid === process.getuid() &&
        storageMetadata.uid === process.getuid());
    const privateUnixMode =
      process.platform === "win32" ||
      ((parentMetadata.mode & 0o077) === 0 &&
        (storageMetadata.mode & 0o077) === 0);
    localStorageRootIsPrivate =
      parentMetadata.isDirectory() &&
      storageMetadata.isDirectory() &&
      !parentMetadata.isSymbolicLink() &&
      !storageMetadata.isSymbolicLink() &&
      isPathWithin(realParent, realStorage) &&
      currentUserOwnsDirectories &&
      privateUnixMode &&
      (await canAccess(resolvedLocalStorageRoot, constants.W_OK));
  } catch {
    localStorageRootIsPrivate = false;
  }
  check(
    localStorageRootIsPrivate,
    "local CV storage root is real, traversal-safe, owner-private, and writable",
  );

  const imageSearchStorageRoot =
    appEnvironment.IMAGE_SEARCH_STORAGE_LOCAL_ROOT ?? "";
  const resolvedImageSearchStorageRoot = resolve(
    imageSearchStorageRoot || root,
  );
  check(
    isAbsolute(imageSearchStorageRoot) &&
      isPathWithin(
        approvedLocalStorageParent,
        resolvedImageSearchStorageRoot,
      ) &&
      resolvedImageSearchStorageRoot !== resolvedLocalStorageRoot,
    "local image-search storage is absolute, purpose-separated, and contained by web/.local",
  );
  let imageSearchStorageRootIsPrivate = false;
  try {
    const [metadata, realParent, realStorage] = await Promise.all([
      lstat(resolvedImageSearchStorageRoot),
      realpath(approvedLocalStorageParent),
      realpath(resolvedImageSearchStorageRoot),
    ]);
    imageSearchStorageRootIsPrivate =
      metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      isPathWithin(realParent, realStorage) &&
      (process.platform === "win32" || (metadata.mode & 0o077) === 0) &&
      (await canAccess(resolvedImageSearchStorageRoot, constants.W_OK));
  } catch {
    imageSearchStorageRootIsPrivate = false;
  }
  check(
    imageSearchStorageRootIsPrivate,
    "local image-search storage is real, private, and writable",
  );

  const isProduction = appEnvironment.APP_ENV === "production";
  const productionUsesRoleCredentials = ![
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
  ].some((key) => Boolean(appEnvironment[key]));
  check(
    !isProduction || productionUsesRoleCredentials,
    "production S3 access uses workload/role credentials rather than app env secrets",
  );
  const productionS3CoordinatesValid = Boolean(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(
      appEnvironment.CV_S3_BUCKET ?? "",
    ) &&
    /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(appEnvironment.CV_S3_REGION ?? "") &&
    appEnvironment.CV_S3_KMS_KEY_ID &&
    !appEnvironment.CV_S3_KMS_KEY_ID.includes(":s3:") &&
    !appEnvironment.CV_S3_KMS_KEY_ID.includes("aws/s3"),
  );
  check(
    !isProduction || productionS3CoordinatesValid,
    "production S3 bucket/region and customer-managed KMS identity are explicit",
  );
  const productionImageSearchS3CoordinatesValid = Boolean(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(
      appEnvironment.IMAGE_SEARCH_S3_BUCKET ?? "",
    ) &&
    /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(
      appEnvironment.IMAGE_SEARCH_S3_REGION ?? "",
    ) &&
    appEnvironment.IMAGE_SEARCH_S3_PREFIX === "image-search/" &&
    appEnvironment.IMAGE_SEARCH_S3_KMS_KEY_ID &&
    !appEnvironment.IMAGE_SEARCH_S3_KMS_KEY_ID.includes("aws/s3") &&
    /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_-]{1,64}$/.test(
      appEnvironment.IMAGE_SEARCH_S3_WORKER_ROLE_ARN ?? "",
    ),
  );
  const localCvConfigurationValid =
    appEnvironment.CV_STORAGE_ADAPTER === "filesystem" &&
    ((appEnvironment.CV_PARSER_ADAPTER === "deterministic" &&
      appEnvironment.CV_OPENAI_ENABLED === "false" &&
      appEnvironment.CV_OPENAI_LOCAL_DEV_ENABLED === "false") ||
      (appEnvironment.CV_PARSER_ADAPTER === "openai" &&
        appEnvironment.CV_OPENAI_ENABLED === "true" &&
        appEnvironment.CV_OPENAI_LOCAL_DEV_ENABLED === "true" &&
        Boolean(appEnvironment.OPENAI_API_KEY)));
  const productionCvConfigurationValid =
    appEnvironment.CV_STORAGE_ADAPTER === "s3" &&
    productionS3CoordinatesValid &&
    productionUsesRoleCredentials &&
    appEnvironment.CV_PARSER_ADAPTER === "openai" &&
    appEnvironment.CV_OPENAI_ENABLED === "true" &&
    appEnvironment.CV_OPENAI_LOCAL_DEV_ENABLED === "false" &&
    appEnvironment.CV_OPENAI_MODEL === "gpt-5.4-mini-2026-03-17" &&
    Boolean(appEnvironment.OPENAI_API_KEY) &&
    appEnvironment.CV_OPENAI_DPA_APPROVED === "true" &&
    appEnvironment.CV_OPENAI_CROSS_BORDER_APPROVED === "true" &&
    appEnvironment.CV_OPENAI_ZDR_APPROVED === "true";
  check(
    isProduction ? productionCvConfigurationValid : localCvConfigurationValid,
    isProduction
      ? "production CV storage/parser configuration fails closed"
      : "local CV storage/parser configuration is explicit and private",
  );
  const localImageSearchConfigurationValid =
    appEnvironment.IMAGE_SEARCH_STORAGE_ADAPTER === "filesystem" &&
    appEnvironment.IMAGE_SEARCH_INTERPRETER === "openai" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_ENABLED === "true" &&
    Boolean(appEnvironment.OPENAI_API_KEY);
  const productionImageSearchConfigurationValid =
    appEnvironment.IMAGE_SEARCH_STORAGE_ADAPTER === "s3" &&
    productionImageSearchS3CoordinatesValid &&
    productionUsesRoleCredentials &&
    appEnvironment.IMAGE_SEARCH_INTERPRETER === "openai" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_ENABLED === "true" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_MODEL === "gpt-5.4-mini-2026-03-17" &&
    Boolean(appEnvironment.OPENAI_API_KEY) &&
    appEnvironment.IMAGE_SEARCH_OPENAI_DPA_APPROVED === "true" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED === "true" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED === "true" &&
    appEnvironment.IMAGE_SEARCH_OPENAI_ZDR_APPROVED === "true";
  check(
    isProduction
      ? productionImageSearchConfigurationValid
      : localImageSearchConfigurationValid,
    isProduction
      ? "production image-search storage/interpreter configuration fails closed"
      : "local image-search storage/interpreter configuration is explicit and private",
  );

  const sharedCvKeys = [
    "CV_STORAGE_ADAPTER",
    "CV_STORAGE_LOCAL_ROOT",
    "CV_ARTIFACT_ACTIVE_KEY_VERSION",
    "CV_ARTIFACT_KEY_V1",
    "CV_CLAMD_SOCKET_PATH",
    "CV_CLAMD_SIGNATURE_MAX_AGE_HOURS",
    "CV_PARSER_ADAPTER",
    "CV_OPENAI_ENABLED",
    "CV_OPENAI_LOCAL_DEV_ENABLED",
    "CV_WORKER_ENABLED",
    "CV_CLEANUP_ENABLED",
    "OCR_ENGINE_ENABLED",
    "OCR_ENGINE_SOCKET_PATH",
    "OCR_ENGINE_NAME",
    "OCR_ENGINE_VERSION",
    "OCR_MODEL_NAME",
    "OCR_MODEL_SHA256",
    "OCR_POLICY_VERSION",
    "OCR_CV_UNIT_TIMEOUT_SECONDS",
    "CV_HYBRID_DEADLINE_SECONDS",
    "OCR_SEARCH_TIMEOUT_SECONDS",
    "IMAGE_SEARCH_WORKER_ENABLED",
    "IMAGE_SEARCH_CLEANUP_ENABLED",
    "IMAGE_SEARCH_STORAGE_ADAPTER",
    "IMAGE_SEARCH_STORAGE_LOCAL_ROOT",
    "IMAGE_SEARCH_ARTIFACT_ACTIVE_KEY_VERSION",
    "IMAGE_SEARCH_ARTIFACT_KEY_V1",
    "IMAGE_SEARCH_RATE_HMAC_KEY_V1",
    "IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1",
    "IMAGE_SEARCH_INTERPRETER",
    "IMAGE_SEARCH_OPENAI_ENABLED",
  ];
  check(
    sharedCvKeys.every((key) => rootEnvironment[key] === appEnvironment[key]),
    "root Compose and web Feature 004/005 worker settings agree",
  );

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

  const adminReadinessRequired =
    appEnvironment.APP_ENV === "production" ||
    appEnvironment.ADMIN_WORKER_ENABLED === "true";
  if (adminReadinessRequired) {
    const adminReadiness = spawnSync(
      process.execPath,
      [resolve(root, "web/scripts/check-admin-evidence-readiness.mjs")],
      {
        cwd: resolve(root, "web"),
        env: { ...process.env, ...rootEnvironment, ...appEnvironment },
        encoding: "utf8",
      },
    );
    check(
      adminReadiness.status === 0,
      "Feature 006 evidence, origin, policy, worker, and prerequisite readiness",
    );
    if (adminReadiness.status !== 0 && adminReadiness.stdout)
      console.error(adminReadiness.stdout.trim());
  }
}
if (failures.length) {
  console.error(`Environment check failed (${failures.length} checks).`);
  process.exit(1);
}
console.log("Environment check passed; no secret values were displayed.");
