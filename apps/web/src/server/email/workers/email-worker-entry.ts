import "server-only";
import { config } from "dotenv";
config({ path: ".env.local", override: false, quiet: true });
await import("./email-worker-runtime");
