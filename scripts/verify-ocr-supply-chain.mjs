import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = process.cwd();
const evidencePath = resolve(root, "web/.local/evidence/ocr-supply-chain.json");
const requiredNpm = {
  "node_modules/sharp": "0.35.3",
  "node_modules/@napi-rs/canvas": "1.0.3",
  "node_modules/openai": "7.3.0",
};

function fail(code) {
  throw new Error(code);
}

async function sourceFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await sourceFiles(path)));
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry.name)))
      output.push(path);
  }
  return output;
}

const lock = JSON.parse(
  await readFile(resolve(root, "package-lock.json"), "utf8"),
);
for (const [path, version] of Object.entries(requiredNpm)) {
  const dependency = lock.packages[path];
  if (
    dependency?.version !== version ||
    !/^sha512-/u.test(dependency.integrity ?? "")
  )
    fail(`OCR_SUPPLY_CHAIN_NPM_PIN_INVALID_${path.replaceAll("/", "_")}`);
}

const pythonFiles = [
  "ocr-engine/requirements.txt",
  "ocr-engine/requirements-dev.txt",
  "ocr-engine/requirements-converter.txt",
];
const pythonPackages = [];
for (const path of pythonFiles) {
  const content = await readFile(resolve(root, path), "utf8");
  const blocks = content.split(/\n(?=[A-Za-z0-9_.-]+==)/u);
  for (const block of blocks) {
    const match = block.match(/^([A-Za-z0-9_.-]+)==([^\s\\]+)/u);
    if (!match) continue;
    if (!block.includes("--hash=sha256:"))
      fail(`OCR_SUPPLY_CHAIN_PYTHON_HASH_MISSING_${match[1]}`);
    pythonPackages.push({ name: match[1], version: match[2], source: path });
  }
}
if (pythonPackages.length < 5) fail("OCR_SUPPLY_CHAIN_PYTHON_LOCK_INCOMPLETE");

const model = JSON.parse(
  await readFile(resolve(root, "ocr-engine/model-manifest.json"), "utf8"),
);
if (
  model.model.license !== "Apache-2.0" ||
  model.runtimeDownloadsAllowed ||
  model.runtimeNetworkAllowed
)
  fail("OCR_SUPPLY_CHAIN_MODEL_POLICY_INVALID");
for (const artifact of [...model.artifacts, ...model.runtimeArtifacts])
  if (!/^[a-f0-9]{64}$/u.test(artifact.sha256))
    fail("OCR_SUPPLY_CHAIN_MODEL_HASH_INVALID");

const dockerfile = await readFile(
  resolve(root, "Dockerfile.ocr-engine"),
  "utf8",
);
for (const artifact of model.artifacts)
  if (!dockerfile.includes(`--checksum=sha256:${artifact.sha256}`))
    fail(`OCR_SUPPLY_CHAIN_DOCKER_CHECKSUM_MISSING_${artifact.name}`);

function verifyDockerBaseImages(name, source) {
  const stages = new Set();
  const pinnedImages = [];
  for (const line of source.match(/^FROM\s+.+$/gmu) ?? []) {
    const match = line.match(
      /^FROM\s+(?:--platform=[^\s]+\s+)?([^\s]+)(?:\s+AS\s+([^\s]+))?$/iu,
    );
    if (!match) fail(`OCR_SUPPLY_CHAIN_DOCKER_FROM_INVALID_${name}`);
    const [, reference, alias] = match;
    if (!stages.has(reference)) {
      if (!reference.includes("@sha256:"))
        fail(`OCR_SUPPLY_CHAIN_BASE_IMAGE_MUTABLE_${name}`);
      pinnedImages.push(reference);
    }
    if (alias) stages.add(alias);
  }
  if (pinnedImages.length === 0)
    fail(`OCR_SUPPLY_CHAIN_BASE_IMAGE_MISSING_${name}`);
  return [...new Set(pinnedImages)];
}

const dockerBaseImages = {};
for (const name of [
  "Dockerfile.ocr-engine",
  "Dockerfile.image-search-worker",
]) {
  const source =
    name === "Dockerfile.ocr-engine"
      ? dockerfile
      : await readFile(resolve(root, name), "utf8");
  dockerBaseImages[name] = verifyDockerBaseImages(name, source);
}

const corpus = JSON.parse(
  await readFile(
    resolve(root, "web/tests/fixtures/ocr-corpus/manifest.json"),
    "utf8",
  ),
);
if (
  corpus.fixtures.some(
    (fixture) =>
      !["SYNTHETIC", "REDISTRIBUTABLE_LICENSED"].includes(fixture.sourceClass),
  )
)
  fail("OCR_SUPPLY_CHAIN_CORPUS_PROVENANCE_INVALID");

const forbiddenClientImports = [];
for (const path of await sourceFiles(resolve(root, "web/src"))) {
  const content = await readFile(path, "utf8");
  if (
    /^\s*["']use client["'];/u.test(content) &&
    /(?:from\s+["'](?:sharp|@napi-rs\/canvas|node:fs|node:crypto)["']|require\(["'](?:sharp|@napi-rs\/canvas))/u.test(
      content,
    )
  )
    forbiddenClientImports.push(relative(root, path));
}
if (forbiddenClientImports.length)
  fail("OCR_SUPPLY_CHAIN_BROWSER_BUNDLE_BOUNDARY_FAILED");

const auditCommand =
  process.platform === "win32"
    ? [
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", "npm.cmd audit --offline --omit=dev --json"],
      ]
    : ["npm", ["audit", "--offline", "--omit=dev", "--json"]];
const audit = JSON.parse(
  (
    await execute(auditCommand[0], auditCommand[1], {
      cwd: root,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    })
  ).stdout,
);
if (
  (audit.metadata?.vulnerabilities?.high ?? 0) > 0 ||
  (audit.metadata?.vulnerabilities?.critical ?? 0) > 0
)
  fail("OCR_SUPPLY_CHAIN_HIGH_VULNERABILITY");

const report = {
  schemaVersion: "smarthire-ocr-supply-chain-v1",
  generatedAt: new Date().toISOString(),
  npm: Object.entries(requiredNpm).map(([path, version]) => ({
    name: path.replace(/^web\//u, "").replace("node_modules/", ""),
    version,
    integrity: lock.packages[path].integrity,
  })),
  python: pythonPackages,
  model: {
    name: model.model.name,
    license: model.model.license,
    artifacts: [...model.artifacts, ...model.runtimeArtifacts].map(
      ({ name, sha256 }) => ({ name, sha256 }),
    ),
  },
  corpus: {
    manifestVersion: corpus.manifestVersion,
    fixtures: corpus.fixtures.length,
    manifestSha256: createHash("sha256")
      .update(
        await readFile(
          resolve(root, "web/tests/fixtures/ocr-corpus/manifest.json"),
        ),
      )
      .digest("hex"),
  },
  browserBundleForbiddenImports: forbiddenClientImports,
  dockerBaseImages,
  vulnerabilitySummary: audit.metadata.vulnerabilities,
  passed: true,
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});
console.log(
  JSON.stringify({ evidencePath: relative(root, evidencePath), passed: true }),
);
