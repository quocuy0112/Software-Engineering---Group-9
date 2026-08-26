import "server-only";

import { CandidateExportWorker } from "./candidate-export-worker";

const maxJobsPerTick = 10;

/**
 * Runs the leased export worker inside the long-lived application process.
 * Database leases still make it safe to run an additional dedicated worker.
 */
export class CandidateExportWorkerRuntime {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly worker = new CandidateExportWorker()) {}

  start(intervalMilliseconds = 2_000) {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMilliseconds);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < maxJobsPerTick; index += 1) {
        if (!(await this.worker.runOnce())) break;
      }
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "EXPORT_RUNTIME_FAILED";
      console.error("[analytics-export] " + code);
    } finally {
      this.running = false;
    }
  }
}
