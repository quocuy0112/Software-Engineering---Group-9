import "server-only";
import { prisma } from "@/backend/database/prisma";
import { DueOutboxProcessor } from "./due-outbox-processor";
import {
  requestEmailWorkerStop,
  runEmailWorkerUntilStopped,
} from "./email-worker-lifecycle";
const processor = new DueOutboxProcessor();
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  requestEmailWorkerStop(processor);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
void runEmailWorkerUntilStopped(processor, () => prisma.$disconnect())
  .then((succeeded) => {
    if (!succeeded) process.exitCode = 1;
  })
  .catch(() => {
    process.exitCode = 1;
  });
