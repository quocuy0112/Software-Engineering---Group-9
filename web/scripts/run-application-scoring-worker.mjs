import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ worker: "application-scoring", ready: false, skipped: true, reason: "DATABASE_URL_NOT_CONFIGURED" }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({ worker: "application-scoring", ready: true, mode: "lease-aware", maxProviderAttempts: 3, staleResultPolicy: "discard" }, null, 2));
