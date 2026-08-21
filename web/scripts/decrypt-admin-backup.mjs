import { createDecipheriv } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const source = valueFor("--file");
const destination = valueFor("--out");

if (args.includes("--help")) {
  console.error(
    "Usage: npm run backup:decrypt -- --file <postgresql.dump.enc> --out <postgresql.dump>",
  );
} else if (!source || !destination) {
  console.error(
    "Usage: npm run backup:decrypt -- --file <postgresql.dump.enc> --out <postgresql.dump>",
  );
  process.exitCode = 1;
} else {
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
  if (key.byteLength !== 32) throw new Error("BACKUP_ENCRYPTION_KEY_INVALID");

  const encrypted = await readFile(resolve(source));
  const marker = Buffer.from("SMARTHIRE-BACKUP-1\n");
  const minimumSize = marker.byteLength + 12 + 16 + 1;
  if (
    encrypted.byteLength < minimumSize ||
    !encrypted.subarray(0, marker.byteLength).equals(marker)
  ) {
    throw new Error("BACKUP_ENCRYPTED_FORMAT_INVALID");
  }

  const ivOffset = marker.byteLength;
  const tagOffset = ivOffset + 12;
  const bodyOffset = tagOffset + 16;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    encrypted.subarray(ivOffset, tagOffset),
  );
  decipher.setAuthTag(encrypted.subarray(tagOffset, bodyOffset));
  const backup = Buffer.concat([
    decipher.update(encrypted.subarray(bodyOffset)),
    decipher.final(),
  ]);

  await writeFile(resolve(destination), backup, { flag: "wx", mode: 0o600 });
  console.log(
    JSON.stringify(
      { output: resolve(destination), byteCount: backup.byteLength },
      null,
      2,
    ),
  );
}
