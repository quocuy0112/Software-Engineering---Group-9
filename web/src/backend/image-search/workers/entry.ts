import "server-only";

import { createImageSearchWorkerResources } from "./resource-factory";
import { ImageSearchWorkerRuntime } from "./runtime";

export async function runImageSearchWorker() {
  const cleanupEnabled = process.env.IMAGE_SEARCH_CLEANUP_ENABLED === "true";
  if (!cleanupEnabled) throw new Error("IMAGE_SEARCH_CLEANUP_REQUIRED");
  const runtime = new ImageSearchWorkerRuntime(
    createImageSearchWorkerResources(),
    {
      processStages: process.env.IMAGE_SEARCH_WORKER_ENABLED === "true",
    },
  );
  const stop = () => void runtime.shutdown();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await runtime.run();
}
