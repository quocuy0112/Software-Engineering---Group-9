import { describe, expect, it } from "vitest";
import { parseServerEnvironment } from "@/lib/env/server";

const local = { APP_ENV: "local", NEXT_PUBLIC_APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://user:pass@localhost:55432/db", DIRECT_URL: "postgresql://user:pass@localhost:55432/db", BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "a".repeat(32), TOKEN_SECRET: "b".repeat(32), AUTH_COOKIE_ENV: "local", EMAIL_DRIVER: "capture", EMAIL_ADAPTER: "capture", EMAIL_CAPTURE_DIRECTORY: ".local/mail", EMAIL_CAPTURE_DIR: ".local/mail", SESSION_COOKIE_NAME: "smarthire.session", PRE_AUTH_COOKIE_NAME: "smarthire.pre-auth", COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax" };

describe("server environment", () => {
  it("accepts unprefixed local HTTP cookies", () => { expect(parseServerEnvironment(local).COOKIE_SECURE).toBe(false); });
  it("rejects insecure prefixed cookies", () => { expect(() => parseServerEnvironment({ ...local, SESSION_COOKIE_NAME: "__Host-smarthire.session" })).toThrow(/SESSION_COOKIE_NAME/); });
  it("accepts the secure production matrix", () => { expect(parseServerEnvironment({ ...local, APP_ENV: "production", AUTH_COOKIE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://smarthire.example", BETTER_AUTH_URL: "https://smarthire.example", COOKIE_SECURE: "true", SESSION_COOKIE_NAME: "__Host-smarthire.session", PRE_AUTH_COOKIE_NAME: "__Secure-smarthire.pre-auth", EMAIL_DRIVER: "resend", EMAIL_ADAPTER: "resend", RESEND_API_KEY: "re_example", EMAIL_FROM: "no-reply@smarthire.example" }).APP_ENV).toBe("production"); });
  it("rejects unsafe production origins", () => { expect(() => parseServerEnvironment({ ...local, APP_ENV: "production", AUTH_COOKIE_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL/); });
  it("redacts invalid secret values", () => { const secret = "short-secret"; expect(() => parseServerEnvironment({ ...local, BETTER_AUTH_SECRET: secret })).toThrowError(new RegExp(`^(?!.*${secret}).*$`)); });
});

describe("SMTP environment validation", () => {
  const smtp = { ...local, EMAIL_DRIVER: "smtp", EMAIL_ADAPTER: "smtp", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587", SMTP_USERNAME: "developer@gmail.com", SMTP_PASSWORD: "app-password", SMTP_FROM: "SmartHire <developer@gmail.com>", SMTP_SECURE: "false", SMTP_USE_TLS: "true" };
  it("accepts Gmail STARTTLS on port 587", () => expect(parseServerEnvironment(smtp)).toMatchObject({ SMTP_PORT: 587, SMTP_SECURE: false, SMTP_USE_TLS: true }));
  it("accepts Gmail implicit TLS on port 465", () => expect(parseServerEnvironment({ ...smtp, SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USE_TLS: "false" })).toMatchObject({ SMTP_PORT: 465, SMTP_SECURE: true }));
  it.each([
    ["missing username", { SMTP_USERNAME: undefined }],
    ["missing password", { SMTP_PASSWORD: undefined }],
    ["invalid port", { SMTP_PORT: "70000" }],
    ["invalid sender", { SMTP_FROM: "SmartHire developer-at-gmail" }],
    ["sender without complete address", { SMTP_FROM: "SmartHire" }],
    ["587 cannot use implicit TLS", { SMTP_PORT: "587", SMTP_SECURE: "true" }],
    ["465 requires implicit TLS", { SMTP_PORT: "465", SMTP_SECURE: "false" }],
  ])("rejects %s", (_name, override) => expect(() => parseServerEnvironment({ ...smtp, ...override })).toThrow());
});
