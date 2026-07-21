import { completeTwoFactorSchema,TWO_FACTOR_GENERIC_ERROR } from "@/features/identity/schemas/two-factor";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { serverEnvironment } from "@/lib/env/runtime";
import { clearPreAuthCookie,readPreAuthCookie } from "@/server/auth/identity/pre-auth-cookie";
import { CompleteTwoFactorService } from "@/server/services/identity/complete-two-factor";
export async function POST(request:Request){const safe=()=>Response.json({message:TWO_FACTOR_GENERIC_ERROR},{status:401,headers:noStoreHeaders});if(!validateSameOrigin(request,serverEnvironment.NEXT_PUBLIC_APP_URL))return Response.json({message:"Request rejected."},{status:403,headers:noStoreHeaders});const parsed=completeTwoFactorSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success||parsed.data.factor!=="totp")return safe();const cookie=readPreAuthCookie(request.headers);if(!cookie)return safe();const result=await new CompleteTwoFactorService().execute(cookie,parsed.data.code,request.headers);if(!result)return safe();const headers=new Headers(noStoreHeaders);headers.append("Set-Cookie",result.sessionCookie);headers.append("Set-Cookie",clearPreAuthCookie());return Response.json({message:"Verification complete."},{headers});}
