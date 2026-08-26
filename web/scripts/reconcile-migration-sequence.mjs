// Keep the historical command name as a compatibility alias. The shared
// reconciler performs checksum validation and handles equivalent legacy rows
// before renaming them to the current contiguous sequence.
if (!process.argv.includes("--apply")) process.argv.push("--apply");
await import("./reconcile-migration-names.mjs");
