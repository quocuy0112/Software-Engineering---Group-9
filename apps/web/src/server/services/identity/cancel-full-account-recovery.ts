import "server-only";
import { ACCOUNT_RECOVERY_GENERIC_ERROR } from "@/features/identity/schemas/password-recovery";
import { PrismaAccountRecoveryRepository } from "@/server/repositories/identity/prisma-account-recovery-repository";

export type CancelFullAccountRecoveryResult =
  | { ok: true; operationId: string }
  | { ok: false; message: string };

export class CancelFullAccountRecoveryService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
  ) {}

  async execute(
    rawProof: string,
    now = new Date(),
  ): Promise<CancelFullAccountRecoveryResult> {
    const result = await this.repository.cancel(rawProof, now).catch(() => null);
    return result
      ? { ok: true, operationId: result.operationId }
      : { ok: false, message: ACCOUNT_RECOVERY_GENERIC_ERROR };
  }
}
