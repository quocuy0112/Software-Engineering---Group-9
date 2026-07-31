import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";

export class EmailAddressUnavailableError extends Error {
  constructor() {
    super("EMAIL_ADDRESS_UNAVAILABLE");
  }
}

export type EmailAddressClaimInput = {
  normalizedEmail: string;
  claimantUserId?: string;
  reservationRequestId?: string;
  now: Date;
};

function assertNormalizedEmail(value: string): void {
  if (
    !value ||
    value !== value.trim() ||
    value !== value.normalize("NFKC").toLocaleLowerCase("en-US") ||
    value.length > 320
  ) {
    throw new Error("NORMALIZED_EMAIL_INVALID");
  }
}

export class EmailAddressClaimCoordinator {
  async assertAvailable(
    tx: Prisma.TransactionClient,
    input: EmailAddressClaimInput,
  ): Promise<void> {
    assertNormalizedEmail(input.normalizedEmail);
    if (Number.isNaN(input.now.getTime()))
      throw new Error("CLAIM_TIME_INVALID");

    // hashtextextended is stable, non-secret, and used only as an advisory-lock
    // identity. It is deliberately independent from TOKEN_SECRET.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`email-claim:v1:${input.normalizedEmail}`}, 0)
      ) IS NULL AS locked
    `;

    await tx.emailChangeRequest.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: input.now },
        OR: [
          { normalizedProposedEmail: input.normalizedEmail },
          ...(input.claimantUserId ? [{ userId: input.claimantUserId }] : []),
        ],
      },
      data: {
        status: "EXPIRED",
        resolvedAt: input.now,
      },
    });

    const [effective, pending] = await Promise.all([
      tx.userAccount.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
        select: { id: true },
      }),
      tx.emailChangeRequest.findFirst({
        where: {
          normalizedProposedEmail: input.normalizedEmail,
          status: "PENDING",
          ...(input.reservationRequestId
            ? { id: { not: input.reservationRequestId } }
            : {}),
        },
        select: { id: true },
      }),
    ]);

    if (effective || pending) throw new EmailAddressUnavailableError();
  }
}
