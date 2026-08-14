import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(webRoot, "..");
const contractPath = resolve(
  repositoryRoot,
  "spec-kit/specs/009-user-management-and-recruiter-verification/contracts/admin-user-verification.openapi.yaml",
);
const consoleContractPath = resolve(
  repositoryRoot,
  "spec-kit/specs/009-user-management-and-recruiter-verification/contracts/admin-console-contract.md",
);
const generatedPath = resolve(
  webRoot,
  "src/shared/contracts/admin/generated/index.ts",
);

const source = await readFile(contractPath, "utf8");
const consoleContract = await readFile(consoleContractPath, "utf8");
const errors = [];
const paths = [...source.matchAll(/^ {2}(\/api\/[^:]+):$/gmu)].map(
  (match) => match[1],
);
const operationIds = [...source.matchAll(/^\s+operationId:\s*([^\s#]+)/gmu)].map(
  (match) => match[1],
);
const duplicates = operationIds.filter(
  (id, index) => operationIds.indexOf(id) !== index,
);
if (duplicates.length) errors.push(`duplicate operationId: ${duplicates.join(", ")}`);

const refs = [
  ...source.matchAll(/\$ref:\s*["']?(#\/components\/[^"'\s},]+)["']?/gmu),
].map((match) => match[1]);
for (const ref of refs) {
  const name = ref.split("/").at(-1);
  if (!name || !new RegExp(`^\\s{4}${name}:`, "mu").test(source))
    errors.push(`unresolved local $ref: ${ref}`);
}

const removedPaths = [...source.matchAll(/^\s+- path:\s*(\/api\/[^\s]+)$/gmu)].map(
  (match) => match[1],
);
const requiredPaths = [
  "/api/admin/accounts",
  "/api/admin/accounts/{accountId}",
  "/api/admin/accounts/{accountId}/suspend",
  "/api/admin/accounts/{accountId}/restore",
  "/api/admin/verification-requests",
  "/api/admin/verification-requests/{requestId}",
  "/api/admin/verification-requests/{requestId}/approve",
  "/api/admin/verification-requests/{requestId}/reject",
];
for (const path of requiredPaths) {
  if (!paths.includes(path)) errors.push(`missing contract path: ${path}`);
}
if (!consoleContract.includes("Feature 009"))
  errors.push("admin-console-contract.md is not the Feature 009 contract");

async function routeFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await routeFiles(full)));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") result.push(full);
  }
  return result;
}

const adminApiRoot = resolve(webRoot, "src/app/api/admin");
const routePaths = [];
for (const file of await routeFiles(adminApiRoot)) {
  const route = relative(resolve(webRoot, "src/app"), dirname(file))
    .split(/[\\/]+/u)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("[...")
        ? `{${part.slice(4, -1)}}`
        : part.startsWith("[")
          ? `{${part.slice(1, -1)}}`
          : part,
    )
    .join("/");
  routePaths.push(`/api/${route}`);
}
for (const removed of [
  "/api/admin/accounts/{accountId}/reinstate",
  "/api/admin/verification-requests/{requestId}/request-changes",
]) {
  if (routePaths.includes(removed)) errors.push(`removed route is still active: ${removed}`);
}

const providerPath = resolve(
  webRoot,
  "src/frontend/features/admin/app/data-provider.ts",
);
const provider = await readFile(providerPath, "utf8");
for (const forbidden of ["request-changes", "Request changes", "reinstate", "Reinstate"]) {
  if (provider.includes(forbidden)) errors.push(`removed provider/control token: ${forbidden}`);
}
for (const relativePath of [
  "src/frontend/features/admin/accounts/account-list.tsx",
  "src/frontend/features/admin/accounts/account-moderation-panel.tsx",
  "src/frontend/features/admin/verification/verification-request-list.tsx",
  "src/frontend/features/admin/verification/verification-decision-panel.tsx",
]) {
  const surface = await readFile(resolve(webRoot, relativePath), "utf8");
  for (const forbidden of ["request-changes", "Request changes", "reinstate", "Reinstate"])
    if (surface.includes(forbidden)) errors.push(`removed UI token in ${relativePath}: ${forbidden}`);
}

const digest = createHash("sha256").update(source).digest("hex");
const generated = `// Generated from Feature 009 admin-user-verification.openapi.yaml. Do not edit by hand.\nexport const adminContractVersion = "0.1.0" as const;\nexport const adminContractSha256 = "${digest}" as const;\nexport const adminContractPaths = ${JSON.stringify(paths, null, 2)} as const;\nexport const adminRemovedPaths = ${JSON.stringify(removedPaths, null, 2)} as const;\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(generatedPath, "utf8").catch(() => "");
  if (current !== generated) errors.push("generated Feature 009 contract exports are stale");
}
if (errors.length) {
  for (const error of errors) console.error(`admin contract: ${error}`);
  process.exitCode = 1;
} else if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ contract: "Feature 009", pathCount: paths.length, drift: false }));
} else {
  await writeFile(generatedPath, generated, "utf8");
  console.log(JSON.stringify({ contract: "Feature 009", pathCount: paths.length, drift: false }));
}
