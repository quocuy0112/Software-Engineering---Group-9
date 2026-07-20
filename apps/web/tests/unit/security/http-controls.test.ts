import { describe, expect, it } from "vitest";
import { clearCookieAttributes, identityCookiePolicy } from "@/lib/security/cookies";
import { validateCsrfRequest } from "@/lib/security/csrf";
import { trustedInternalRedirect } from "@/lib/security/trusted-redirect";
import { noStoreHeaders } from "@/lib/security/response-headers";

describe("identity HTTP controls", () => {
  it("uses exactly one authentication cookie and one non-authenticating challenge cookie per environment", () => {
    const local=identityCookiePolicy({APP_ENV:"local",SESSION_COOKIE_NAME:"smarthire.session",PRE_AUTH_COOKIE_NAME:"smarthire.pre-auth",COOKIE_SECURE:false});
    const production=identityCookiePolicy({APP_ENV:"production",SESSION_COOKIE_NAME:"__Host-smarthire.session",PRE_AUTH_COOKIE_NAME:"__Secure-smarthire.pre-auth",COOKIE_SECURE:true});
    expect(local).toMatchObject({session:{name:"smarthire.session",attributes:{secure:false,path:"/"}},preAuth:{name:"smarthire.pre-auth",attributes:{secure:false}}});
    expect(production).toMatchObject({session:{name:"__Host-smarthire.session",attributes:{secure:true,path:"/"}},preAuth:{name:"__Secure-smarthire.pre-auth",attributes:{secure:true}}});
    expect(clearCookieAttributes(production.session.attributes)).toMatchObject({...production.session.attributes,maxAge:0});
    expect([production.session.name].filter((name)=>name.includes("session"))).toHaveLength(1);
  });
  it("requires exact origin, same-origin fetch metadata, and CSRF proof", () => {
    const request=(origin:string,site:string,proof:string)=>new Request("https://app.example.test/api/state",{method:"POST",headers:{origin,"sec-fetch-site":site,"x-csrf-token":proof}});
    expect(validateCsrfRequest(request("https://app.example.test","same-origin","proof"),"https://app.example.test","proof")).toBe(true);
    expect(validateCsrfRequest(request("https://evil.test","same-origin","proof"),"https://app.example.test","proof")).toBe(false);
    expect(validateCsrfRequest(request("https://app.example.test","cross-site","proof"),"https://app.example.test","proof")).toBe(false);
    expect(validateCsrfRequest(request("https://app.example.test","same-origin","wrong"),"https://app.example.test","proof")).toBe(false);
  });
  it.each(["https://evil.test/x","//evil.test","/%2f%2fevil.test","/\\evil","/%5cevil","/ok%0d%0aLocation:evil","javascript:alert(1)"])("rejects unsafe redirect %s", (value) => {
    expect(trustedInternalRedirect(value,"https://app.example.test","/home")).toBe("/home");
  });
  it("accepts an exact-origin relative redirect",()=>expect(trustedInternalRedirect("/settings?tab=sessions","https://app.example.test")).toBe("/settings?tab=sessions"));
  it("applies no-store, framing, referrer, and script policy to sensitive responses",()=>{expect(noStoreHeaders["Cache-Control"]).toContain("no-store");expect(noStoreHeaders["Content-Security-Policy"]).toContain("frame-ancestors 'none'");expect(noStoreHeaders["Referrer-Policy"]).toBe("no-referrer");});
});
