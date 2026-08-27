"use client";

import { useState } from "react";
import { ChecklistItem } from "@/frontend/components/ui/checklist-item";
import { ContentTabs } from "@/frontend/components/ui/content-tabs";
import { StatChip } from "@/frontend/components/ui/stat-chip";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
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
import { JobMetaIcon } from "./job-meta-icon";
import { jobCopy } from "./job-copy";

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
  const copy = jobCopy(useWorkspaceLocale());
  if (!items.length) {
    return <p className="job-section-muted">{copy.moreDetailsHiringTeam}</p>;
  }

  return (
    <ul className="job-detail-bullet-list">
      {items.map((item, index) => (
        <ChecklistItem
          key={item + "-" + index}
          text={<BulletContent item={item} />}
        />
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
  const locale = useWorkspaceLocale();
  const copy = jobCopy(locale);
  const facts = [
    {
      icon: <JobMetaIcon name="person" />,
      label: copy.age,
      value: job.age?.trim() || copy.notListed,
    },
    {
      icon: <JobMetaIcon name="education" />,
      label: copy.educationLevel,
      value: job.education?.trim() || copy.notListed,
    },
  ];
  const specialization = jobCategories(job, locale);

  return (
    <section
      id="overview"
      className="job-detail-section-card job-detail-overview-card"
      aria-labelledby="overview-heading"
    >
      <div className="job-detail-overview-header">
        <SectionHeading
          headingId="overview-heading"
          eyebrow={copy.overview}
          title={copy.overview}
          copy={copy.overviewDescription}
        />
      </div>

      <div
        className="job-overview-facts"
        aria-label={copy.jobRequirementsAtAGlance}
      >
        {facts.map((fact) => (
          <StatChip
            className="job-overview-stat"
            key={fact.label}
            icon={fact.icon}
            label={fact.label}
            value={fact.value}
          />
        ))}
      </div>

      <div className="job-overview-specialization">
        <InlineChips
          items={specialization.slice(0, 10)}
          label={copy.specialization}
          ariaLabel={copy.jobSpecialization}
        />
        <InlineChips
          items={jobSkills(job).slice(0, 14)}
          label={copy.requiredSkills}
          ariaLabel={copy.requiredSkills}
        />
      </div>
    </section>
  );
}

type TabId = "description" | "requirements" | "benefits";

function detailTabs(copy: ReturnType<typeof jobCopy>): readonly {
  id: TabId;
  label: string;
  description: string;
}[] {
  return [
    {
      id: "description",
      label: copy.jobDescription,
      description: copy.jobDescriptionDescription,
    },
    {
      id: "requirements",
      label: copy.requirements,
      description: copy.requirementsDescription,
    },
    {
      id: "benefits",
      label: copy.benefits,
      description: copy.benefitsDescription,
    },
  ];
}

function DescriptionContent({ job }: { job: JobDetail }) {
  const copy = jobCopy(useWorkspaceLocale());
  return (
    <>
      <div className="job-detail-section-copy">
        <p>{jobOverview(job)}</p>
      </div>
      <InlineChips
        items={jobSkills(job).slice(0, 8)}
        label={copy.roleFocus}
        ariaLabel={copy.roleFocusSkills}
      />
      <div className="job-detail-section-subblock">
        <h3 id="responsibilities-heading">{copy.keyResponsibilities}</h3>
        <BulletList items={jobResponsibilities(job)} />
      </div>
    </>
  );
}

function RequirementsContent({ job }: { job: JobDetail }) {
  const copy = jobCopy(useWorkspaceLocale());
  const mustHave = jobMustHaveRequirements(job);
  const niceToHave = jobNiceToHaveRequirements(job);

  return (
    <>
      <InlineChips
        items={jobSkills(job)}
        label={copy.requiredSkills}
        ariaLabel={copy.requiredSkills}
      />
      <div className="job-requirement-columns">
        <div>
          <h3>{copy.mustHaveRequirements}</h3>
          <BulletList items={mustHave} />
        </div>
        <div className="job-requirement-nice">
          <h3>{copy.niceToHave}</h3>
          {niceToHave.length ? (
            <BulletList items={niceToHave} />
          ) : (
            <p className="job-section-muted">{copy.noNiceToHave}</p>
          )}
        </div>
      </div>
    </>
  );
}

function BenefitsContent({ job }: { job: JobDetail }) {
  const copy = jobCopy(useWorkspaceLocale());
  const benefits = jobBenefits(job);

  return benefits.length ? (
    <ul className="job-benefit-grid" aria-label={copy.benefits}>
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
    <p className="job-section-muted">{copy.benefitsInterview}</p>
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
  const copy = jobCopy(useWorkspaceLocale());
  const tabs = detailTabs(copy);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="job-detail-sections" aria-label={copy.jobDetails}>
      {includeOverview ? <JobDetailOverview job={job} /> : null}
      <section
        id="job-details-tabs"
        className="job-detail-section-card job-detail-tab-card"
        aria-labelledby="job-details-tabs-heading"
      >
        <h2 id="job-details-tabs-heading" className="sr-only">
          {copy.jobDetails}
        </h2>
        <ContentTabs
          tabs={tabs.map((tab) => ({
            id: "job-detail-tab-" + tab.id,
            label: tab.label,
          }))}
          activeIndex={tabs.findIndex((tab) => tab.id === activeTab)}
          onChange={(index) => setActiveTab(tabs[index]?.id ?? "description")}
          ariaLabel={copy.jobDetailSections}
          panelId="job-detail-tab-panel"
        />
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
