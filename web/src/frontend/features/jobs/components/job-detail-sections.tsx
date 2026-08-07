"use client";

import Link from "next/link";
import { useState } from "react";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import {
  jobCategories,
  jobBenefits,
  jobMustHaveRequirements,
  jobNiceToHaveRequirements,
  jobOverview,
  jobResponsibilities,
  jobSkills,
} from "./job-detail-data";

export type JobDetailSectionId =
  | "description"
  | "requirements"
  | "benefits"
  | "company";

const benefitIcon: Record<string, string> = {
  award: "★",
  bonus: "$",
  calendar: "◷",
  car: "↗",
  coffee: "•",
  dollar: "$",
  "dollar-sign": "$",
  globe: "◉",
  heart: "♡",
  health: "+",
  insurance: "+",
  learning: "↗",
  "book-open": "↗",
  shield: "✓",
  spark: "✦",
  users: "◉",
};

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="job-section-muted">
        More details will be shared by the hiring team.
      </p>
    );
  }

  return (
    <ul className="job-detail-bullet-list">
      {items.map((item, index) => (
        <li key={item + "-" + index}>
          <span className="job-bullet-marker" aria-hidden="true">
            ✓
          </span>
          <BulletContent item={item} />
        </li>
      ))}
    </ul>
  );
}

function BulletContent({ item }: { item: string }) {
  const match = item.match(/^(.{2,70}?)(?::|-)\s+(.+)$/u);

  return match ? (
    <span>
      <strong>{match[1]}</strong> {match[2]}
    </span>
  ) : (
    <span>{item}</span>
  );
}

function InlineChips({
  items,
  label,
  ariaLabel,
}: {
  items: string[];
  label: string;
  ariaLabel: string;
}) {
  if (!items.length) return null;

  return (
    <div className="job-detail-inline-chip-group">
      <p className="job-detail-inline-chip-label">{label}</p>
      <ul className="job-detail-inline-chips" aria-label={ariaLabel}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  headingId,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  headingId: string;
}) {
  return (
    <div className="job-detail-section-heading">
      <p className="panel-kicker">{eyebrow}</p>
      <h2 id={headingId}>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export function JobDetailOverview({ job }: { job: JobDetail }) {
  const facts = [
    {
      label: "Experience",
      value:
        job.experienceMinYears !== undefined
          ? job.experienceMinYears + "+ years"
          : "Not listed",
    },
    {
      label: "Age",
      value: job.age?.trim() || "Not listed",
    },
    {
      label: "Education level",
      value: job.education?.trim() || "Not listed",
    },
  ];
  const specialization = jobCategories(job);

  return (
    <section
      id="overview"
      className="job-detail-section-card job-detail-overview-card"
      aria-labelledby="overview-heading"
    >
      <div className="job-detail-overview-header">
        <SectionHeading
          headingId="overview-heading"
          eyebrow="OVERVIEW"
          title="Overview"
          copy="The essentials at a glance before you dive into the role."
        />
        <Link className="job-similar-jobs-link" href="/jobs">
          Send me similar jobs
        </Link>
      </div>

      <div
        className="job-overview-facts"
        aria-label="Job requirements at a glance"
      >
        {facts.map((fact) => (
          <div className="job-overview-fact" key={fact.label}>
            <span className="job-overview-fact-label">{fact.label}</span>
            <span className="job-detail-tag">{fact.value}</span>
          </div>
        ))}
      </div>

      <div className="job-overview-specialization">
        <p className="job-detail-inline-chip-label">Specialization</p>
        {specialization.length ? (
          <ul
            className="job-detail-inline-chips"
            aria-label="Job specialization"
          >
            {specialization.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <span className="job-detail-tag">Not listed</span>
        )}
      </div>
    </section>
  );
}

type TabId = "description" | "requirements" | "benefits";

const detailTabs: readonly {
  id: TabId;
  label: string;
  description: string;
}[] = [
  {
    id: "description",
    label: "Job description",
    description:
      "A clear view of the work, expectations, and impact you can make.",
  },
  {
    id: "requirements",
    label: "Requirements",
    description: "The signals that will help you do well in this role.",
  },
  {
    id: "benefits",
    label: "Benefits",
    description:
      "The full package, kept together so you can compare with confidence.",
  },
];

function DescriptionContent({ job }: { job: JobDetail }) {
  return (
    <>
      <div className="job-detail-section-copy">
        <p>{jobOverview(job)}</p>
      </div>
      <InlineChips
        items={jobSkills(job).slice(0, 8)}
        label="Role focus"
        ariaLabel="Role focus skills"
      />
      <div className="job-detail-section-subblock">
        <h3 id="responsibilities-heading">Key responsibilities</h3>
        <BulletList items={jobResponsibilities(job)} />
      </div>
    </>
  );
}

function RequirementsContent({ job }: { job: JobDetail }) {
  const mustHave = jobMustHaveRequirements(job);
  const niceToHave = jobNiceToHaveRequirements(job);

  return (
    <>
      <InlineChips
        items={jobSkills(job)}
        label="Required skills"
        ariaLabel="Required skills"
      />
      <div className="job-requirement-columns">
        <div>
          <h3>Must-have requirements</h3>
          <BulletList items={mustHave} />
        </div>
        <div className="job-requirement-nice">
          <h3>Nice-to-have</h3>
          {niceToHave.length ? (
            <BulletList items={niceToHave} />
          ) : (
            <p className="job-section-muted">
              No additional nice-to-have requirements were provided.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function BenefitsContent({ job }: { job: JobDetail }) {
  const benefits = jobBenefits(job);

  return benefits.length ? (
    <ul className="job-benefit-grid" aria-label="Job benefits">
      {benefits.map((benefit, index) => (
        <li key={benefit.label + "-" + index}>
          <span className="job-benefit-icon" aria-hidden="true">
            {benefitIcon[benefit.icon.toLowerCase()] ?? "*"}
          </span>
          <span>{benefit.label}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="job-section-muted">
      Benefits details will be shared during the interview process.
    </p>
  );
}

function TabContent({ activeTab, job }: { activeTab: TabId; job: JobDetail }) {
  if (activeTab === "requirements") return <RequirementsContent job={job} />;
  if (activeTab === "benefits") return <BenefitsContent job={job} />;
  return <DescriptionContent job={job} />;
}

export function JobDetailSections({
  job,
  includeOverview = true,
}: {
  job: JobDetail;
  section?: JobDetailSectionId;
  includeOverview?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("description");
  const activeTabConfig =
    detailTabs.find((tab) => tab.id === activeTab) ?? detailTabs[0];

  return (
    <div className="job-detail-sections" aria-label="Job details">
      {includeOverview ? <JobDetailOverview job={job} /> : null}
      <section
        id="job-details-tabs"
        className="job-detail-section-card job-detail-tab-card"
        aria-labelledby="job-details-tabs-heading"
      >
        <h2 id="job-details-tabs-heading" className="sr-only">
          Job details
        </h2>
        <div
          className="job-detail-tab-list"
          role="tablist"
          aria-label="Job detail sections"
        >
          {detailTabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={"job-detail-tab-" + tab.id}
                className={"job-detail-tab" + (selected ? " is-active" : "")}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="job-detail-tab-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="job-detail-tab-description">
          {activeTabConfig.description}
        </p>
        <div
          id="job-detail-tab-panel"
          className="job-detail-tab-panel"
          role="tabpanel"
          aria-labelledby={"job-detail-tab-" + activeTab}
          tabIndex={0}
          key={activeTab}
        >
          <TabContent activeTab={activeTab} job={job} />
        </div>
      </section>
    </div>
  );
}
