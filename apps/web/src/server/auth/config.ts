import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";
import { preserveExternalBetterAuthSignInRateLimit } from "./identity/better-auth-internal-request";
import { authCookiePolicy, betterAuthCookieOptions } from "./cookie-policy";

const cookiePolicy = authCookiePolicy(serverEnvironment);

export const auth = betterAuth({
  appName: "SmartHire",
  baseURL: serverEnvironment.BETTER_AUTH_URL,
  secret: serverEnvironment.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnvironment.NEXT_PUBLIC_APP_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  rateLimit: {
    customRules: {
      "/sign-in/email": preserveExternalBetterAuthSignInRateLimit,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  socialProviders: {},
  user: {
    modelName: "UserAccount",
    additionalFields: {
      normalizedEmail: { type: "string", required: false, input: false },
      state: {
        type: "string",
        required: true,
        input: false,
        defaultValue: "PENDING_VERIFICATION",
      },
      stateChangedAt: {
        type: "date",
        required: true,
        input: false,
        defaultValue: () => new Date(),
      },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  account: { modelName: "AuthProviderAccount" },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7 - 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
    additionalFields: {
      lastActivityAt: {
        type: "date",
        required: true,
        input: false,
        defaultValue: () => new Date(),
      },
      absoluteExpiresAt: {
        type: "date",
        required: true,
        input: false,
        defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      revokedAt: { type: "date", required: false, input: false },
      revocationReason: { type: "string", required: false, input: false },
    },
  },
  verification: { modelName: "Verification" },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, normalizedEmail: user.email.trim().toLowerCase() },
        }),
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.userAccount.findUnique({
            where: { id: session.userId },
            select: {
              state: true,
              passwordResetOperations: {
                where: { finalizedAt: null },
                select: { id: true },
                take: 1,
              },
              fullAccountRecoveryOperations: {
                where: { status: { in: ["CONFIRMED_HOLD", "COMPLETING"] } },
                select: { id: true },
                take: 1,
              },
            },
          });
          return user?.state === "ACTIVE" &&
            user.passwordResetOperations.length === 0 &&
            user.fullAccountRecoveryOperations.length === 0
            ? { data: session }
            : false;
        },
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "SmartHire",
      twoFactorTable: "TwoFactor",
      twoFactorCookieMaxAge: 300,
      trustDeviceMaxAge: 0,
      skipVerificationOnEnable: false,
      allowPasswordless: false,
      backupCodeOptions: { storeBackupCodes: "encrypted", amount: 10 },
    }),
  ],
  advanced: betterAuthCookieOptions(cookiePolicy),
});
