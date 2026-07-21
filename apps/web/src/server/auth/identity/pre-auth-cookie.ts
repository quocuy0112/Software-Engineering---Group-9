import "server-only";
import { identityCookiePolicy, clearCookieAttributes } from "@/lib/security/cookies";
import { serverEnvironment } from "@/lib/env/runtime";

export function encodePreAuth(handle:string,binding:string){return `${handle}~${Buffer.from(binding).toString("base64url")}`;}
export function decodePreAuth(value:string){const at=value.indexOf("~");if(at<1)return null;try{return{handle:value.slice(0,at),binding:Buffer.from(value.slice(at+1),"base64url").toString()};}catch{return null;}}
function serialize(name:string,value:string,a:{httpOnly:true;secure:boolean;sameSite:"lax";path:string;maxAge?:number;expires?:Date}){return [
  `${name}=${encodeURIComponent(value)}`,`Path=${a.path}`,a.httpOnly&&"HttpOnly",`SameSite=Lax`,a.secure&&"Secure",
  a.maxAge!==undefined&&`Max-Age=${a.maxAge}`,a.expires&&`Expires=${a.expires.toUTCString()}`].filter(Boolean).join("; ");}
export function setPreAuthCookie(value:string){const p=identityCookiePolicy(serverEnvironment);return serialize(p.preAuth.name,value,p.preAuth.attributes);}
export function clearPreAuthCookie(){const p=identityCookiePolicy(serverEnvironment);return serialize(p.preAuth.name,"",clearCookieAttributes(p.preAuth.attributes));}
export function readPreAuthCookie(headers:Headers){const name=identityCookiePolicy(serverEnvironment).preAuth.name;const part=headers.get("cookie")?.split(/;\s*/).find(v=>v.startsWith(`${name}=`));return part?decodeURIComponent(part.slice(name.length+1)):null;}
export function providerCookieHeader(binding:string){return `${identityCookiePolicy(serverEnvironment).preAuth.name}=${binding}`;}
