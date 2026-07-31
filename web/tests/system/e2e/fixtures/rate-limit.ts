import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { Client } from "pg";

loadEnvironment({ path: resolve(process.cwd(), ".env.local"), quiet: true });

/**
 * Stateful browser journeys sometimes need more successful logins than the
 * production five-attempt window permits. Clear only that journey's hashed
 * account bucket after a proven successful login; production policy and
 * failure-path coverage remain unchanged.
 */
export async function clearSuccessfulLoginRateLimit(email: string) {
  const connectionString = process.env.DATABASE_URL;
  const tokenSecret = process.env.TOKEN_SECRET;
  if (!connectionString || !tokenSecret) {
    throw new Error("E2E_RATE_LIMIT_FIXTURE_ENV_REQUIRED");
  }

  const subjectDigest = createHmac("sha256", tokenSecret)
    .update(`anonymous:${email}`.normalize("NFKC"))
    .digest("hex");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM "RateLimitBucket"
       WHERE "scope" = 'login' AND "subjectDigest" = $1`,
      [subjectDigest],
    );
  } finally {
    await client.end();
  }
}
