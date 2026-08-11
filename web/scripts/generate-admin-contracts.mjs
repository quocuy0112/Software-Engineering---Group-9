import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contract = resolve(
  root,
  "../spec-kit/specs/006-admin-management/contracts/admin-api.openapi.yaml",
);
const output = resolve(root, "src/shared/contracts/admin/generated.ts");
const source = await readFile(contract, "utf8");
const paths = [...source.matchAll(/^ {2}(\/api\/[^:]+):$/gmu)].map(
  (match) => match[1],
);
const digest = createHash("sha256").update(source).digest("hex");
const generated = `// Generated from Feature 006 OpenAPI. Do not edit by hand.\nexport const adminContractVersion = "0.2.0" as const;\nexport const adminContractSha256 = "${digest}" as const;\nexport const adminContractPaths = ${JSON.stringify(paths, null, 2)} as const;\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(output, "utf8").catch(() => "");
  if (current !== generated) {
    console.error("Feature 006 generated contract is stale");
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify({
        contract: "Feature 006 admin API",
        version: "0.2.0",
        pathCount: paths.length,
        sha256: digest,
        drift: false,
      }),
    );
  }
} else {
  await writeFile(output, generated, "utf8");
}
