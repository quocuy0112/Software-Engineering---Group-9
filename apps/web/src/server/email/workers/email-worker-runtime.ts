import "server-only";
import { prisma } from "@/lib/db/prisma";
import { DueOutboxProcessor } from "./due-outbox-processor";
const processor = new DueOutboxProcessor();
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  processor.stop();
  await prisma.$disconnect();
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
processor
  .run()
  .then(shutdown)
  .catch(async () => {
    await shutdown();
    process.exitCode = 1;
  });
