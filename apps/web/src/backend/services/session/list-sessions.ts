import "server-only";
import type { PublicSession } from "@/shared/contracts/identity/session";
import { PrismaSessionPolicyRepository } from "@/backend/repositories/identity/prisma-session-policy-repository";
function device(value: string | null) {
  if (!value) return "Unknown device";
  if (/mobile/i.test(value)) return "Mobile browser";
  return "Desktop browser";
}
function location(value: string | null) {
  return value?.startsWith("127.") || value === "::1"
    ? "Local device"
    : "Approximate location unavailable";
}
export class ListSessionsService {
  constructor(
    private readonly repository = new PrismaSessionPolicyRepository(),
  ) {}
  async execute(userId: string, currentId: string): Promise<PublicSession[]> {
    return (await this.repository.list(userId)).map((row) => ({
      reference: row.id,
      current: row.id === currentId,
      device: device(row.userAgent),
      lastActiveAt: row.lastActivityAt.toISOString(),
      expiresAt: row.absoluteExpiresAt.toISOString(),
      approximateLocation: location(row.ipAddress),
    }));
  }
}
