import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { serverEnvironment } from "@/backend/env/runtime";

const freeEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

export function createCompanyEmailToken() {
  return randomBytes(32).toString("base64url");
}

export function digestCompanyEmailValue(value: string) {
  return createHmac("sha256", serverEnvironment.TOKEN_SECRET)
    .update(`company-email-v1:${value}`, "utf8")
    .digest("hex");
}

export function maskCompanyEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 2) ?? "**"}***@${domain ?? "***"}`;
}

export function companyEmailSignals(email: string, websiteOrigin?: string | null) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const websiteDomain = websiteOrigin
    ? new URL(websiteOrigin).hostname.replace(/^www\./u, "").toLowerCase()
    : null;
  return {
    freeProvider: freeEmailDomains.has(domain),
    websiteDomainMatch: websiteDomain
      ? domain === websiteDomain || domain.endsWith(`.${websiteDomain}`)
      : null,
  };
}
