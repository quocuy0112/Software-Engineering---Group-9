import "server-only";
import { randomUUID } from "node:crypto";
import type { EmailService } from "../email-service";
import { deliverClaimedOutbox, selectedEmailAdapter } from "./email-outbox";
import { PrismaOutboxRepository } from "@/server/repositories/email/outbox-repository";
export class DueOutboxProcessor {
  private stopping = false;
  constructor(
    private readonly repository = new PrismaOutboxRepository(),
    private readonly adapter: EmailService = selectedEmailAdapter(),
    private readonly owner = `worker:${randomUUID()}`,
    private readonly batchSize = 10,
  ) {}
  stop() {
    this.stopping = true;
  }
  async pollOnce(now = new Date()) {
    if (this.stopping) return 0;
    const rows = await this.repository.claimDue(
      this.owner,
      now,
      this.batchSize,
    );
    await Promise.all(
      rows.map((row) =>
        deliverClaimedOutbox(
          row,
          this.owner,
          this.adapter,
          this.repository,
          now,
        ),
      ),
    );
    return rows.length;
  }
  async run(pollMs = 1000) {
    while (!this.stopping) {
      const count = await this.pollOnce();
      if (!count && !this.stopping)
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}
