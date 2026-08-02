import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";
import { PrismaClient } from "../src/backend/generated/prisma/client";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

if (process.env.APP_ENV !== "local") {
  throw new Error("Job demo data can only be seeded when APP_ENV=local.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Run npm run env:init first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

const skills = [
  { name: "TypeScript", normalizedName: "typescript" },
  { name: "React", normalizedName: "react" },
  { name: "Node.js", normalizedName: "node js" },
  { name: "SQL", normalizedName: "sql" },
  { name: "Data Analysis", normalizedName: "data analysis" },
] as const;

const jobs = [
  {
    id: "demo-job-typescript-engineer",
    slug: "typescript-engineer-smarthire-demo",
    title: "TypeScript Engineer",
    summary: "Build reliable and accessible hiring experiences for candidates.",
    description:
      "Join a product team building secure recruitment workflows used by candidates and hiring teams.",
    responsibilities:
      "Deliver product increments, review code, improve performance, and collaborate with design and QA.",
    requirements:
      "Strong TypeScript fundamentals, experience with web applications, and clear communication.",
    benefits:
      "Hybrid work, learning budget, private health insurance, and modern equipment.",
    location: "Ho Chi Minh City",
    employmentType: "FULL_TIME",
    experienceLevel: "MID",
    workArrangement: "HYBRID",
    salaryMin: 30_000_000,
    salaryMax: 50_000_000,
    skillNames: ["typescript", "react", "node js"],
  },
  {
    id: "demo-job-frontend-react",
    slug: "frontend-react-engineer-smarthire-demo",
    title: "Frontend React Engineer",
    summary:
      "Create fast, inclusive interfaces for a growing HR technology platform.",
    description:
      "Work closely with product designers to turn complex recruitment journeys into simple experiences.",
    responsibilities:
      "Build React components, test user flows, improve accessibility, and maintain frontend quality.",
    requirements:
      "Hands-on React and TypeScript experience with a strong understanding of semantic HTML and CSS.",
    benefits:
      "Remote-friendly team, flexible hours, and annual professional development support.",
    location: "Da Nang",
    employmentType: "FULL_TIME",
    experienceLevel: "JUNIOR",
    workArrangement: "REMOTE",
    salaryMin: 20_000_000,
    salaryMax: 35_000_000,
    skillNames: ["react", "typescript"],
  },
  {
    id: "demo-job-backend-node",
    slug: "senior-backend-nodejs-smarthire-demo",
    title: "Senior Backend Node.js Engineer",
    summary: "Design dependable services for high-trust recruitment workflows.",
    description:
      "Own backend services that protect candidate data and keep hiring workflows consistent.",
    responsibilities:
      "Design APIs, model PostgreSQL data, review security controls, and mentor engineers.",
    requirements:
      "Production Node.js, SQL, API design, and transactional data modeling experience.",
    benefits:
      "Competitive salary, leadership track, health coverage, and a yearly bonus.",
    location: "Ha Noi",
    employmentType: "FULL_TIME",
    experienceLevel: "SENIOR",
    workArrangement: "ONSITE",
    salaryMin: 45_000_000,
    salaryMax: 70_000_000,
    skillNames: ["node js", "typescript", "sql"],
  },
  {
    id: "demo-job-data-analyst",
    slug: "product-data-analyst-smarthire-demo",
    title: "Product Data Analyst",
    summary:
      "Turn recruitment data into practical product and operations insights.",
    description:
      "Partner with product and operations teams to understand candidate journeys and marketplace health.",
    responsibilities:
      "Define metrics, build trusted analyses, communicate findings, and improve reporting quality.",
    requirements:
      "Strong SQL, analytical thinking, data storytelling, and careful handling of private data.",
    benefits:
      "Flexible contract, hybrid schedule, and access to analytics training.",
    location: "Ho Chi Minh City",
    employmentType: "CONTRACT",
    experienceLevel: "ENTRY",
    workArrangement: "HYBRID",
    salaryMin: 18_000_000,
    salaryMax: 28_000_000,
    skillNames: ["sql", "data analysis"],
  },
  {
    id: "demo-job-software-intern",
    slug: "software-engineering-intern-smarthire-demo",
    title: "Software Engineering Intern",
    summary:
      "Learn modern product engineering while shipping useful features with a mentor.",
    description:
      "Join a structured internship with real product work, weekly feedback, and guided technical learning.",
    responsibilities:
      "Implement scoped features, write tests, document decisions, and participate in code reviews.",
    requirements:
      "Programming fundamentals, curiosity, consistent learning habits, and basic web knowledge.",
    benefits:
      "Paid internship, dedicated mentor, team equipment, and conversion opportunities.",
    location: "Ha Noi",
    employmentType: "INTERNSHIP",
    experienceLevel: "ENTRY",
    workArrangement: "ONSITE",
    salaryMin: 7_000_000,
    salaryMax: 12_000_000,
    skillNames: ["typescript", "react"],
  },
] as const;

async function seed() {
  const publishedAt = new Date();
  const applicationDeadline = new Date(publishedAt);
  applicationDeadline.setUTCDate(applicationDeadline.getUTCDate() + 60);

  const company = await prisma.company.upsert({
    where: { slug: "smarthire-demo" },
    update: {
      displayName: "SmartHire Labs",
      publicDescription:
        "A verified demo employer used to explore the SmartHire job board locally.",
      publicLocation: "Viet Nam",
      websiteUrl: "https://example.com/smarthire-labs",
      verifiedAt: publishedAt,
    },
    create: {
      id: "demo-company-smarthire-labs",
      slug: "smarthire-demo",
      legalName: "SmartHire Labs Demo Company Limited",
      displayName: "SmartHire Labs",
      publicDescription:
        "A verified demo employer used to explore the SmartHire job board locally.",
      publicLocation: "Viet Nam",
      websiteUrl: "https://example.com/smarthire-labs",
      verifiedAt: publishedAt,
    },
  });

  const skillByName = new Map<string, string>();
  for (const skill of skills) {
    const saved = await prisma.skill.upsert({
      where: { normalizedName: skill.normalizedName },
      update: { name: skill.name },
      create: {
        id: `demo-skill-${skill.normalizedName.replaceAll(" ", "-")}`,
        ...skill,
      },
    });
    skillByName.set(skill.normalizedName, saved.id);
  }

  for (const job of jobs) {
    const searchDocumentNormalized = normalize(
      `${job.title} ${company.displayName} ${job.location} ${job.skillNames.join(" ")} ${job.summary} ${job.description}`,
    );
    const data = {
      companyId: company.id,
      title: job.title,
      normalizedTitle: normalize(job.title),
      summary: job.summary,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      benefits: job.benefits,
      location: job.location,
      normalizedLocation: normalize(job.location),
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      workArrangement: job.workArrangement,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: "VND",
      salaryPeriod: "MONTH" as const,
      searchDocumentNormalized,
      status: "ACTIVE" as const,
      approvedAt: publishedAt,
      publishedAt,
      applicationDeadline,
      closedAt: null,
      removedAt: null,
    };
    await prisma.jobPosting.upsert({
      where: { slug: job.slug },
      update: data,
      create: { id: job.id, slug: job.slug, ...data },
    });

    for (const [position, normalizedName] of job.skillNames.entries()) {
      const skillId = skillByName.get(normalizedName);
      if (!skillId) throw new Error(`Missing seeded skill: ${normalizedName}`);
      await prisma.jobPostingSkill.upsert({
        where: {
          jobPostingId_skillId: { jobPostingId: job.id, skillId },
        },
        update: {
          displayName:
            skills.find((skill) => skill.normalizedName === normalizedName)
              ?.name ?? normalizedName,
          required: position === 0,
          position,
        },
        create: {
          jobPostingId: job.id,
          skillId,
          displayName:
            skills.find((skill) => skill.normalizedName === normalizedName)
              ?.name ?? normalizedName,
          required: position === 0,
          position,
        },
      });
    }

    await prisma.applicationQuestion.upsert({
      where: { id: `${job.id}-question-availability` },
      update: {
        prompt: "When could you start this role?",
        kind: "TEXT",
        required: true,
        position: 0,
        active: true,
      },
      create: {
        id: `${job.id}-question-availability`,
        jobPostingId: job.id,
        prompt: "When could you start this role?",
        kind: "TEXT",
        required: true,
        position: 0,
      },
    });
  }

  console.log(
    `Seeded ${jobs.length} active demo jobs for ${company.displayName}.`,
  );
}

async function main() {
  try {
    await seed();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
