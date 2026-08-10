import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = resolve(webRoot, "prisma/migrations");
const entries = await readdir(migrationsRoot, { withFileTypes: true });
const names = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "en"));

const invalid = names.filter(
  (name) => !/^\d{3}_[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(name),
);
if (invalid.length) {
  throw new Error(
    `Migration directories must use NNN_snake_case: ${invalid.join(", ")}`,
  );
}

const outOfSequence = names
  .map((name, index) => ({
    expected: String(index + 1).padStart(3, "0"),
    actual: name.slice(0, 3),
    name,
  }))
  .filter((entry) => entry.actual !== entry.expected);
if (outOfSequence.length) {
  throw new Error(
    `Migration sequence has gaps or duplicates: ${outOfSequence
      .map((entry) => `${entry.name} (expected ${entry.expected})`)
      .join(", ")}`,
  );
}

console.log(
  JSON.stringify(
    {
      migrationCount: names.length,
      first: names.at(0),
      last: names.at(-1),
      namingConvention: "NNN_snake_case",
      pass: true,
    },
    null,
    2,
  ),
);
