/**
 * Canonical recruiter job-classification taxonomy.
 *
 * Keep the predefined category ids explicit instead of deriving them from the
 * display labels. The catalogue already contains these identifiers and the
 * same mapping is consumed by recruiter forms and public search taxonomy.
 */
export const recruiterIndustryTaxonomy = [
  {
    code: "r01",
    label: "Sales & Business Development",
    subIndustries: [
      ["B2B Sales", "r01-b2b-sales"],
      ["B2C Sales", "r01-b2c-sales"],
      ["Telesales & Online Sales", "r01-telesales-online-sales"],
      ["Business Development", "r01-business-development"],
      ["Sales Support", "r01-sales-support"],
      ["Distribution & Agency Channel", "r01-distribution-agency-channel"],
      ["Specialized Sales", "r01-specialized-sales"],
    ],
  },
  {
    code: "r02",
    label: "Marketing / PR / Advertising / Communications",
    subIndustries: [
      ["Digital Marketing", "r02-digital-marketing"],
      ["Content Creation", "r02-content-creation"],
      ["Advertising & Creative", "r02-advertising-creative"],
      [
        "Brand / Trade / Product Marketing",
        "r02-brand-trade-product-marketing",
      ],
      ["PR & Events", "r02-pr-events"],
      ["Market Research", "r02-market-research"],
    ],
  },
  {
    code: "r03",
    label: "Information Technology (IT)",
    subIndustries: [
      ["Software Development", "r03-software-development"],
      ["IT Product & Project Management", "r03-it-product-project-management"],
      ["Software Testing (QA/QC)", "r03-software-testing-qa-qc"],
      ["Data & AI", "r03-data-ai"],
      ["Cybersecurity", "r03-cybersecurity"],
      [
        "Infrastructure, Networking & DevOps",
        "r03-infrastructure-networking-devops",
      ],
      ["IT Operations & Support", "r03-it-operations-support"],
      ["Hardware & Embedded Systems", "r03-hardware-embedded-systems"],
    ],
  },
  {
    code: "r04",
    label: "Accounting / Auditing / Tax / Corporate Finance",
    subIndustries: [
      ["Accounting", "r04-accounting"],
      ["Taxation", "r04-taxation"],
      ["Auditing & Internal Control", "r04-auditing-internal-control"],
      ["Corporate Finance", "r04-corporate-finance"],
    ],
  },
  {
    code: "r05",
    label: "Administration / Office / Executive Support / Legal",
    subIndustries: [
      ["Secretarial & Executive Support", "r05-secretarial-executive-support"],
      ["General Administration", "r05-general-administration"],
      ["Reception", "r05-reception"],
      ["Data Entry & Archiving", "r05-data-entry-archiving"],
      ["Legal & Compliance", "r05-legal-compliance"],
    ],
  },
  {
    code: "r06",
    label: "Human Resources (HR)",
    subIndustries: [
      [
        "Recruitment / Talent Acquisition",
        "r06-recruitment-talent-acquisition",
      ],
      ["Learning & Development", "r06-learning-development"],
      ["Compensation & Benefits", "r06-compensation-benefits"],
      ["HR Business Partner", "r06-hr-business-partner"],
      ["General HR Management", "r06-general-hr-management"],
    ],
  },
  {
    code: "r07",
    label: "Electrical / Electronics / M&E / Energy",
    subIndustries: [
      ["Operations & Maintenance", "r07-operations-maintenance"],
      ["HVAC & Refrigeration", "r07-hvac-refrigeration"],
      ["Electronics & Semiconductor", "r07-electronics-semiconductor"],
      ["Energy", "r07-energy"],
      ["Electrical & M&E", "r07-electrical-me"],
    ],
  },
  {
    code: "r08",
    label: "Mechanical / Automotive / Automation",
    subIndustries: [
      ["Mechanical Engineering", "r08-mechanical-engineering"],
      ["Automotive", "r08-automotive"],
      ["Automation", "r08-automation"],
    ],
  },
  {
    code: "r09",
    label: "Construction / Architecture / Interior Design",
    subIndustries: [
      ["Construction", "r09-construction"],
      ["Estimation & Design", "r09-estimation-design"],
      ["Architecture & Interior Design", "r09-architecture-interior-design"],
    ],
  },
  {
    code: "r10",
    label: "Supply Chain / Logistics / Import-Export",
    subIndustries: [
      ["Import-Export", "r10-import-export"],
      ["Procurement", "r10-procurement"],
      ["Transport & Warehousing", "r10-transport-warehousing"],
      ["Supply Chain", "r10-supply-chain"],
    ],
  },
  {
    code: "r11",
    label: "Manufacturing / Assembly / Processing",
    subIndustries: [
      ["Operations & Engineering", "r11-operations-engineering"],
      ["Quality Management", "r11-quality-management"],
      ["Production Labor", "r11-production-labor"],
    ],
  },
  {
    code: "r12",
    label: "Customer Service",
    subIndustries: [
      ["Call Center & CS", "r12-call-center-cs"],
      ["Management", "r12-management"],
    ],
  },
  {
    code: "r13",
    label: "Design / Graphics / Creative Arts",
    subIndustries: [
      ["Graphic & Digital Design", "r13-graphic-digital-design"],
      ["Fashion & Product Design", "r13-fashion-product-design"],
      ["Media & Photography", "r13-media-photography"],
    ],
  },
  {
    code: "r14",
    label: "Health, Safety & Environment (HSE)",
    subIndustries: [
      ["Safety", "r14-safety"],
      ["Environment", "r14-environment"],
    ],
  },
  {
    code: "r15",
    label: "Finance / Banking / Securities",
    subIndustries: [
      ["Banking", "r15-banking"],
      ["Securities & Brokerage", "r15-securities-brokerage"],
      ["Investment Finance", "r15-investment-finance"],
    ],
  },
  {
    code: "r16",
    label: "Insurance",
    subIndustries: [["Insurance", "r16-insurance-general"]],
  },
  {
    code: "r17",
    label: "Real Estate",
    subIndustries: [["Real Estate", "r17-real-estate-general"]],
  },
  {
    code: "r18",
    label: "Healthcare / Medical / Pharmaceuticals",
    subIndustries: [
      ["Medical", "r18-medical"],
      ["Pharmaceuticals", "r18-pharmaceuticals"],
      ["Research", "r18-research"],
    ],
  },
  {
    code: "r19",
    label: "Retail / Wholesale / Store Management",
    subIndustries: [["Retail", "r19-retail-general"]],
  },
  {
    code: "r20",
    label: "Hospitality / Restaurant / Tourism",
    subIndustries: [
      ["Hotel & Restaurant", "r20-hotel-restaurant"],
      ["Tourism", "r20-tourism"],
    ],
  },
  {
    code: "r21",
    label: "Education / Training",
    subIndustries: [["Education", "r21-education-general"]],
  },
  {
    code: "r22",
    label: "E-Commerce",
    subIndustries: [["E-Commerce", "r22-e-commerce-general"]],
  },
  {
    code: "r23",
    label: "Cosmetics / Spa / Beauty",
    subIndustries: [["Beauty & Spa", "r23-beauty-spa-general"]],
  },
  {
    code: "r24",
    label: "Translation / Interpretation",
    subIndustries: [["Translation", "r24-translation-general"]],
  },
  {
    code: "r25",
    label: "Media / Journalism / Publishing",
    subIndustries: [["Media & Publishing", "r25-media-publishing-general"]],
  },
  {
    code: "r26",
    label: "Textiles / Footwear / Fashion",
    subIndustries: [["Textiles & Footwear", "r26-textiles-footwear-general"]],
  },
  {
    code: "r27",
    label: "Agriculture / Forestry / Fisheries & Science",
    subIndustries: [
      ["Agriculture & Science", "r27-agriculture-science-general"],
    ],
  },
  {
    code: "r28",
    label: "General Labor & Drivers",
    subIndustries: [
      ["General Labor", "r28-general-labor"],
      ["Drivers", "r28-drivers"],
    ],
  },
  {
    code: "r29",
    label: "Other",
    subIndustries: null,
  },
] as const;

export type RecruiterIndustryOption =
  (typeof recruiterIndustryTaxonomy)[number];
export type StandardIndustryCode = Exclude<
  RecruiterIndustryOption["code"],
  "r29"
>;
export type RecruiterIndustryCode = RecruiterIndustryOption["code"];
export type RecruiterSubIndustry = readonly [string, string];

export const standardRecruiterIndustries = recruiterIndustryTaxonomy.filter(
  (industry): industry is Exclude<RecruiterIndustryOption, { code: "r29" }> =>
    industry.code !== "r29",
);

export const recruiterIndustryByCode = new Map(
  recruiterIndustryTaxonomy.map((industry) => [industry.code, industry]),
);

export const recruiterIndustryByLabel = new Map(
  recruiterIndustryTaxonomy.map((industry) => [industry.label, industry]),
);

const legacyOtherCodes = new Set(["other"]);

function normalizedLabel(value: string) {
  return value.trim().toLowerCase();
}

export function recruiterIndustryOptionFor(input: {
  code?: string | null;
  industryCode?: string | null;
  label?: string | null;
}): RecruiterIndustryOption {
  const code = (input.code ?? input.industryCode)?.trim().toLowerCase() ?? "";
  const byCode =
    recruiterIndustryByCode.get(code as RecruiterIndustryCode) ??
    (legacyOtherCodes.has(code) ? recruiterIndustryByCode.get("r29") : null);
  if (byCode) return byCode;

  const label = normalizedLabel(input.label ?? "");
  const byLabel = recruiterIndustryTaxonomy.find(
    (industry) => normalizedLabel(industry.label) === label,
  );
  return byLabel ?? recruiterIndustryByCode.get("r29")!;
}

export function isRecruiterIndustrySelectionValid(input: {
  code?: string | null;
  industryCode?: string | null;
  label?: string | null;
}) {
  const code = (input.code ?? input.industryCode)?.trim().toLowerCase() ?? "";
  if (recruiterIndustryByCode.has(code as RecruiterIndustryCode)) return true;
  if (legacyOtherCodes.has(code)) return true;
  if (code) return false;
  const label = normalizedLabel(input.label ?? "");
  return recruiterIndustryTaxonomy.some(
    (industry) => normalizedLabel(industry.label) === label,
  );
}

export function subIndustryOptionFor(
  industry: RecruiterIndustryOption,
  value: string,
) {
  if (industry.subIndustries === null) return undefined;
  const normalized = normalizedLabel(value);
  return industry.subIndustries.find(
    ([label]) => normalizedLabel(label) === normalized,
  );
}

/** Slugifier for recruiter-entered sub-industries under any industry branch. */
export function slugifyRecruiterSubIndustry(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[\s/&]+/gu, "-")
    .replace(/[^a-z0-9-]+/gu, "")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
}

export type RecruiterSubIndustrySuggestions = Readonly<
  Record<string, readonly string[]>
>;

/** Collect existing labels without turning them into canonical taxonomy ids. */
export function collectRecruiterSubIndustrySuggestions(
  jobs: readonly {
    industry?: string | null;
    industryCode?: string | null;
    subIndustry?: string | null;
  }[],
): RecruiterSubIndustrySuggestions {
  const labelsByIndustry = new Map<string, Map<string, string>>();
  for (const job of jobs) {
    const label = job.subIndustry?.trim();
    if (!label) continue;
    const industry = recruiterIndustryOptionFor(job);
    const labels = labelsByIndustry.get(industry.code) ?? new Map();
    labelsByIndustry.set(industry.code, labels);
    if (!labels.has(normalizedLabel(label))) {
      labels.set(normalizedLabel(label), label);
    }
  }
  return Object.fromEntries(
    [...labelsByIndustry].map(([code, labels]) => [
      code,
      [...labels.values()].sort((left, right) => left.localeCompare(right)),
    ]),
  );
}

export type RecruiterClassification = {
  industry: string;
  industryCode: RecruiterIndustryCode;
  industryId: string;
  subIndustry: string;
  subIndustryId: string | null;
  subIndustryCode: string | null;
  categoryFamily: RecruiterIndustryCode;
  categoryIds: string[];
  department: string | null;
  valid: boolean;
};

export function deriveRecruiterClassification(input: {
  industry?: string | null;
  industryCode?: string | null;
  industryId?: string | null;
  subIndustry?: string | null;
  subIndustryId?: string | null;
  subIndustryCode?: string | null;
}): RecruiterClassification {
  const industry = recruiterIndustryOptionFor({
    code: input.industryCode,
    label: input.industry,
  });
  const rawSubIndustry = input.subIndustry?.trim() ?? "";
  const industrySelectionValid = isRecruiterIndustrySelectionValid({
    code: input.industryCode,
    label: input.industry,
  });

  const selected = subIndustryOptionFor(industry, rawSubIndustry);
  if (selected) {
    return {
      industry: industry.label,
      industryCode: industry.code,
      industryId: industry.code,
      subIndustry: selected[0],
      subIndustryId: selected[1],
      subIndustryCode: selected[1],
      categoryFamily: industry.code,
      categoryIds: [selected[1]],
      department: selected[0],
      valid: industrySelectionValid,
    };
  }

  const slug = slugifyRecruiterSubIndustry(rawSubIndustry);
  return {
    industry: industry.label,
    industryCode: industry.code,
    industryId: industry.code,
    subIndustry: rawSubIndustry,
    subIndustryId: null,
    subIndustryCode: null,
    categoryFamily: industry.code,
    // Other has no curated children, so its typed label is the stable child
    // identity. Custom labels under a curated industry retain the generic
    // fallback until that label is promoted into the shared taxonomy.
    categoryIds: slug
      ? [industry.code === "r29" ? `r29-${slug}` : `${industry.code}-other`]
      : [],
    department: rawSubIndustry || null,
    valid: industrySelectionValid && Boolean(rawSubIndustry && slug),
  };
}
