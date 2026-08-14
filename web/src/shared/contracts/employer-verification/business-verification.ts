import { z } from "zod";

const markup = /<[^>]*>/gu;

function stripUnsafeBusinessControls(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code <= 0x08 ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        (code >= 0x7f && code <= 0x9f) ||
        code === 0x200e ||
        code === 0x200f ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("");
}

export function normalizeBusinessPlainText(value: string): string {
  return stripUnsafeBusinessControls(value.normalize("NFKC"))
    .replace(markup, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const plainText = (minimum: number, maximum: number) =>
  z
    .string()
    .transform(normalizeBusinessPlainText)
    .pipe(z.string().min(minimum).max(maximum));

export const businessTaxIdentifierSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(/^[0-9]{10}$/u));

export const companyEmailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email().max(254));

export function normalizeVietnamesePhone(value: string): string {
  if (/[a-z]|(?:ext|x)\s*\d/iu.test(value)) throw new Error("PHONE_INVALID");
  const compact = stripUnsafeBusinessControls(value).replace(/[\s.()-]/gu, "");
  const national = compact.startsWith("+84")
    ? compact.slice(3)
    : compact.startsWith("0")
      ? compact.slice(1)
      : "";
  if (!/^[0-9]{9,10}$/u.test(national)) throw new Error("PHONE_INVALID");
  return `+84${national}`;
}

export const companyPhoneSchema = z
  .string()
  .max(32)
  .transform((value, context) => {
    try {
      return normalizeVietnamesePhone(value);
    } catch {
      context.addIssue({ code: "custom", message: "PHONE_INVALID" });
      return z.NEVER;
    }
  });

const blockedHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
};

export function normalizeCompanyWebsite(value: string): string {
  const candidate = value.trim();
  if (!candidate) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/iu.test(candidate)
    ? candidate
    : `https://${candidate}`;
  const url = new URL(withScheme);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== "443") ||
    blockedHost(url.hostname)
  ) {
    throw new Error("WEBSITE_INVALID");
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
  if (!hostname.includes(".") || hostname.length > 253) {
    throw new Error("WEBSITE_INVALID");
  }
  return `https://${hostname}`;
}

export const companyWebsiteSchema = z
  .string()
  .max(2_048)
  .transform((value, context) => {
    try {
      return normalizeCompanyWebsite(value);
    } catch {
      context.addIssue({ code: "custom", message: "WEBSITE_INVALID" });
      return z.NEVER;
    }
  })
  .optional();

export const employerApplicantRelationshipSchema = z.enum([
  "LEGAL_OWNER",
  "AUTHORIZED_EMPLOYEE",
  "INVITED_MEMBER",
  "EXISTING_OWNER_APPROVAL",
  "OTHER",
]);

const formBooleanSchema = z.preprocess((value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false" || value === undefined) return false;
  return value;
}, z.boolean());

export const registryLookupSchema = z
  .object({ taxIdentifier: businessTaxIdentifierSchema })
  .strict();

export const companyEmailChallengeSchema = z
  .object({
    preparationVersion: z.number().int().positive(),
    email: companyEmailSchema,
  })
  .strict();

export const companyEmailConfirmationSchema = z
  .object({ token: z.string().min(43).max(128) })
  .strict();

export const preparationPatchSchema = z
  .object({
    preparationId: z.string().min(1),
    version: z.number().int().positive(),
    changes: z
      .object({
        applicantLegalName: plainText(1, 240).nullable().optional(),
        applicantRegisteredAddress: plainText(5, 500).nullable().optional(),
        operatingAddressDiffers: z.boolean().optional(),
        operatingAddress: plainText(5, 500).nullable().optional(),
        companyPhone: companyPhoneSchema.nullable().optional(),
        website: companyWebsiteSchema.nullable().optional(),
        relationship: employerApplicantRelationshipSchema.nullable().optional(),
        currentJobTitle: plainText(2, 120).nullable().optional(),
        authorityExplanation: plainText(20, 500).nullable().optional(),
        mismatchExplanation: plainText(20, 500).nullable().optional(),
      })
      .strict(),
  })
  .strict();

export const enrichedVerificationSubmissionSchema = z
  .object({
    preparationId: z.string().min(1),
    preparationVersion: z.coerce.number().int().positive(),
    lookupSnapshotId: z.string().min(1),
    taxIdentifier: businessTaxIdentifierSchema,
    applicantLegalName: plainText(1, 240),
    applicantRegisteredAddress: plainText(5, 500),
    operatingAddressDiffers: formBooleanSchema,
    operatingAddress: plainText(5, 500).optional(),
    companyPhone: companyPhoneSchema,
    website: companyWebsiteSchema,
    relationship: employerApplicantRelationshipSchema,
    currentJobTitle: plainText(2, 120),
    authorityExplanation: plainText(20, 500).optional(),
    mismatchExplanation: plainText(20, 500).optional(),
    accuracyDeclaration: z.literal("true"),
    documentProcessingConsent: z.literal("true"),
    policyVersion: z.string().min(1).max(40),
    requestedRole: z.literal("RECRUITER"),
    targetCompanyId: z.string().min(1).optional(),
    prerequisiteId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.operatingAddressDiffers && !input.operatingAddress) {
      context.addIssue({
        code: "custom",
        path: ["operatingAddress"],
        message: "OPERATING_ADDRESS_REQUIRED",
      });
    }
    if (
      ["AUTHORIZED_EMPLOYEE", "OTHER"].includes(input.relationship) &&
      !input.authorityExplanation
    ) {
      context.addIssue({
        code: "custom",
        path: ["authorityExplanation"],
        message: "AUTHORITY_EXPLANATION_REQUIRED",
      });
    }
  });

export function businessFactsDiffer(left: string | null, right: string | null) {
  if (!left || !right) return false;
  return normalizeBusinessPlainText(left).toLocaleLowerCase("vi") !==
    normalizeBusinessPlainText(right).toLocaleLowerCase("vi");
}
