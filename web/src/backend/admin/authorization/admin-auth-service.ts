import "server-only";
import { z } from "zod";
import { prisma } from "@/backend/database/prisma";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import { CompleteTwoFactorService } from "@/backend/services/two-factor/complete-two-factor";
import { BetterAuthGateway } from "@/backend/auth/better-auth/better-auth-gateway";
import { AdministratorSessionService } from "./administrator-session-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});
export const adminFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/u),
  factor: z.literal("totp").default("totp"),
});

function sessionToken(cookie: string) {
  const first = cookie.split(";", 1)[0] ?? "";
  return decodeURIComponent(first.slice(first.indexOf("=") + 1));
}

export class AdminAuthService {
  async context(authority: { userId: string }) {
    const account = await prisma.userAccount.findUnique({
      where: { id: authority.userId },
      select: { name: true },
    });
    return { displayName: account?.name ?? "Administrator" };
  }

  async login(data: z.infer<typeof adminLoginSchema>, request: Request) {
    const account = await prisma.userAccount.findUnique({
      where: { normalizedEmail: data.email },
      select: {
        twoFactorEnabled: true,
        platformAdministratorGrants: {
          where: {
            state: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (
      !account?.twoFactorEnabled ||
      account.platformAdministratorGrants.length !== 1
    ) {
      return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
    }
    return new LoginWithPasswordService().execute(data, {
      headers: request.headers,
      subject: "admin-origin",
    });
  }

  async completeInitialFactor(cookie: string, code: string, request: Request) {
    const result = await new CompleteTwoFactorService().execute(
      cookie,
      code,
      request.headers,
      new Date(),
      "totp",
    );
    if (!result || "rateLimited" in result) return null;
    const session = await prisma.session.findUnique({
      where: { token: sessionToken(result.sessionCookie) },
      select: { id: true, userId: true },
    });
    if (!session) return null;
    await new AdministratorSessionService().designate({
      sessionId: session.id,
      userId: session.userId,
    });
    return result.sessionCookie;
  }

  async stepUp(request: Request, code: string) {
    const authority = await new AdminRequestBoundary().require(request);
    const verified = await new BetterAuthGateway()
      .verifyTotp(request.headers, code)
      .then(() => true)
      .catch(() => false);
    if (!verified) return false;
    await new AdministratorSessionService().stepUp(authority);
    return true;
  }
}
