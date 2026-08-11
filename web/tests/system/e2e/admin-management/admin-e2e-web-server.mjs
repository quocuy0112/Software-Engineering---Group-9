import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const webRoot = process.cwd();
process.env.EMAIL_ADAPTER = "capture";
process.env.ADMIN_EVIDENCE_STORAGE_ROOT = resolve(
  webRoot,
  ".local/admin-e2e/evidence",
);
process.argv = [process.execPath, "next", "dev", "--webpack", "--port", "3001"];

await import(
  pathToFileURL(resolve(webRoot, "../node_modules/next/dist/bin/next")).href
);
