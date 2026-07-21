import "server-only";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";

export const PRE_AUTH_LIFETIME_MS = 5 * 60 * 1000;
export const PRE_AUTH_MAX_ATTEMPTS = 5;
export type ClaimedChallenge = { id: string; userId: string; claimTime: Date };

export class PrismaPreAuthRepository {
  constructor(private readonly protector = new TokenProtector()) {}
  async create(userId: string, browserBinding: string, now = new Date()) {
    const token = this.protector.generate();
    await prisma.authenticationChallenge.create({ data: {
      userId, purpose: "PASSWORD_LOGIN_2FA", handleDigest: this.protector.digest(token),
      contextDigest: this.protector.digest(`browser:${browserBinding}`), expiresAt: new Date(now.getTime() + PRE_AUTH_LIFETIME_MS),
      maxAttempts: PRE_AUTH_MAX_ATTEMPTS, createdAt: now,
    }});
    return { token, expiresAt: new Date(now.getTime() + PRE_AUTH_LIFETIME_MS) };
  }
  async claimAttempt(token: string, browserBinding: string, now = new Date()): Promise<ClaimedChallenge | null> {
    const digest=this.protector.digest(token), context=this.protector.digest(`browser:${browserBinding}`);
    const rows=await prisma.$queryRaw<ClaimedChallenge[]>`
      UPDATE "AuthenticationChallenge" SET "attemptCount"="attemptCount"+1, "consumedAt"=${now}
      WHERE "handleDigest"=${digest} AND "contextDigest"=${context} AND "purpose"='PASSWORD_LOGIN_2FA'::"ChallengePurpose"
        AND "consumedAt" IS NULL AND "expiresAt">${now} AND "attemptCount"<"maxAttempts"
      RETURNING "id", "userId", "consumedAt" AS "claimTime"`;
    return rows[0]??null;
  }
  async releaseFailed(id:string, claimTime:Date){await prisma.authenticationChallenge.updateMany({where:{id,consumedAt:claimTime},data:{consumedAt:null}});}
  async finalize(id:string,userId:string,claimTime:Date,step:bigint){return prisma.$transaction(async tx=>{
    const replay=await tx.authenticationChallenge.findFirst({where:{userId,verifiedTotpStep:step,consumedAt:{not:null}},select:{id:true}});
    if(replay)return false;
    const result=await tx.authenticationChallenge.updateMany({where:{id,userId,consumedAt:claimTime},data:{verifiedTotpStep:step}});
    return result.count===1;
  });}
}
