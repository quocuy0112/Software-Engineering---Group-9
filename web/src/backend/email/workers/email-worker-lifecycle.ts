import "server-only";

export type EmailWorkerLoop = {
  run(): Promise<void>;
  stop(): void;
};

export function requestEmailWorkerStop(worker: EmailWorkerLoop): void {
  worker.stop();
}

export async function runEmailWorkerUntilStopped(
  worker: EmailWorkerLoop,
  disconnect: () => Promise<void>,
): Promise<boolean> {
  let succeeded = true;
  try {
    await worker.run();
  } catch {
    succeeded = false;
  } finally {
    await disconnect();
  }
  return succeeded;
}
