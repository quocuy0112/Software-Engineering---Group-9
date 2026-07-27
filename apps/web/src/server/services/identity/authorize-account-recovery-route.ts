import "server-only";
import type { AccountRecoveryCapabilityKind } from "@/features/identity/schemas/password-recovery";
import { PrismaAccountRecoveryRepository } from "@/server/repositories/identity/prisma-account-recovery-repository";

export class AuthorizeAccountRecoveryRouteService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
  ) {}

  async execute(
    kind: AccountRecoveryCapabilityKind,
    rawProof: string,
    now = new Date(),
  ) {
    try {
      return await this.repository.isRouteProofValid(kind, rawProof, now);
    } catch {
      return false;
    }
  }
}
