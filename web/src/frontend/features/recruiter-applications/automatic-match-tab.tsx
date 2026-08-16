"use client";

import {
  Check,
  CircleAlert,
  CircleX,
  FileSearch,
  Gauge,
  Minus,
  Plus,
} from "lucide-react";
import type {
  AutomaticMatch,
  FinalScore,
  SkillEvidence,
} from "@/shared/contracts/scoring";

function SkillChips({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string;
  items: SkillEvidence[];
  tone: "found" | "missing" | "preferred";
  icon: typeof Check;
}) {
  return (
    <div className={`automatic-skill-group automatic-skill-group--${tone}`}>
      <span className="automatic-skill-group__label">
        <Icon aria-hidden="true" /> {title}
      </span>
      {items.length ? (
        <div className="automatic-skill-chips">
          {items.map((item) => (
            <span
              className="automatic-skill-chip"
              key={`${item.requirementKind}-${item.skillCode}`}
            >
              <Icon aria-hidden="true" /> {item.label}
            </span>
          ))}
        </div>
      ) : (
        <span className="ranking-muted-text">None detected</span>
      )}
    </div>
  );
}

function ScoreCard({
  title,
  value,
  meta,
  tone,
  progress,
}: {
  title: string;
  value: string;
  meta: string;
  tone: "blue" | "purple" | "green";
  progress: number;
}) {
  return (
    <article className={`automatic-score-card automatic-score-card--${tone}`}>
      <div>
        <span>{title}</span>
        <small>{meta}</small>
      </div>
      <strong>{value}</strong>
      <span className="automatic-score-card__track">
        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </span>
    </article>
  );
}

export function AutomaticMatchTab({
  automatic,
  finalScore,
  aiScore,
  retrying = false,
}: {
  automatic: AutomaticMatch | null;
  finalScore: FinalScore | null;
  aiScore?: number | null;
  retrying?: boolean;
}) {
  if (!automatic) {
    return (
      <div className="ranking-empty-panel" role="status">
        <LoaderPlaceholder />
        <h3>Automatic match is processing</h3>
        <p>
          The deterministic result will appear here when the CV and job
          snapshots are ready.
        </p>
      </div>
    );
  }

  const experienceDelta =
    automatic.minimumExperienceYears === null ||
    automatic.detectedExperience.kind !== "DETECTED"
      ? null
      : automatic.detectedExperience.years - automatic.minimumExperienceYears;
  const evidence = [
    ...automatic.foundRequiredSkills,
    ...automatic.preferredSkills,
  ].flatMap((item) => item.evidence.map((excerpt) => ({ item, excerpt })));

  return (
    <div className="ranking-tab-content">
      <div className="automatic-score-cards" aria-label="Score components">
        <ScoreCard
          title="Automatic match"
          value={`${automatic.score}/100`}
          meta="Weight 60%"
          tone="blue"
          progress={automatic.score}
        />
        <ScoreCard
          title="AI assessment"
          value={
            finalScore && aiScore !== null && aiScore !== undefined
              ? `${aiScore}/100`
              : retrying
                ? "Processing"
                : "Unavailable"
          }
          meta="Weight 40%"
          tone="purple"
          progress={aiScore ?? 0}
        />
        <ScoreCard
          title="Final score"
          value={
            finalScore
              ? `${finalScore.value}/100`
              : retrying
                ? "Pending"
                : "—/100"
          }
          meta={
            finalScore
              ? "Hybrid result"
              : retrying
                ? "AI retry in progress"
                : "AI unavailable"
          }
          tone="green"
          progress={finalScore?.value ?? automatic.score}
        />
      </div>

      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon" aria-hidden="true">
          <Gauge />
        </span>
        <strong>
          {finalScore
            ? finalScore.formulaText
            : retrying
              ? `Deterministic ${automatic.score}/100 ready · AI retry in progress`
              : `Deterministic match: ${automatic.score}/100 · AI unavailable`}
        </strong>
        <span>
          JD {automatic.jdVersion} · CV {automatic.cvVersion} · Config{" "}
          {automatic.configVersion}
        </span>
      </div>

      {automatic.mayBeIncomplete ? (
        <div className="ranking-warning" role="status">
          <CircleAlert aria-hidden="true" />
          <span>
            {automatic.incompletenessLabel ??
              "Some source data may be incomplete."}
          </span>
        </div>
      ) : null}

      <div className="automatic-match-grid">
        <section className="ranking-panel automatic-skills-panel">
          <div className="ranking-section-heading">
            <div>
              <h3>Skills required for the role</h3>
              <p>Matched against the current job description</p>
            </div>
            <span className="ranking-version-tag">Required + preferred</span>
          </div>
          <SkillChips
            title="Found in the CV"
            items={automatic.foundRequiredSkills}
            tone="found"
            icon={Check}
          />
          <SkillChips
            title="Missing required skill"
            items={automatic.missingRequiredSkills}
            tone="missing"
            icon={CircleX}
          />
          <SkillChips
            title="Preferred skills"
            items={automatic.preferredSkills}
            tone="preferred"
            icon={Plus}
          />
        </section>
        <section className="ranking-panel automatic-experience-panel">
          <div className="ranking-section-heading">
            <div>
              <h3>Experience</h3>
              <p>Deterministic CV signal</p>
            </div>
            <FileSearch aria-hidden="true" />
          </div>
          <div className="experience-metric experience-metric--required">
            <span>Minimum required</span>
            <strong>
              {automatic.minimumExperienceYears === null
                ? "Not specified"
                : `${automatic.minimumExperienceYears} years`}
            </strong>
          </div>
          <div className="experience-metric experience-metric--detected">
            <span>Detected in the CV</span>
            <strong>
              {automatic.detectedExperience.kind === "DETECTED"
                ? `${automatic.detectedExperience.years} years`
                : "Not detected"}
            </strong>
          </div>
          <div
            className={`experience-delta ${experienceDelta !== null && experienceDelta >= 0 ? "is-positive" : "is-warning"}`}
          >
            {experienceDelta !== null && experienceDelta >= 0 ? (
              <Check aria-hidden="true" />
            ) : (
              <CircleAlert aria-hidden="true" />
            )}
            <span>
              {automatic.minimumExperienceYears === null ||
              automatic.minimumExperienceYears <= 0
                ? "No minimum configured"
                : experienceDelta !== null && experienceDelta >= 0
                  ? `Exceeds requirement by ${experienceDelta} ${experienceDelta === 1 ? "year" : "years"}`
                  : "Minimum experience not established"}
            </span>
          </div>
        </section>
      </div>

      <section className="ranking-panel evidence-panel">
        <div className="ranking-section-heading">
          <div>
            <h3>
              <FileSearch aria-hidden="true" /> Evidence found in the CV
            </h3>
            <p>Verbatim excerpts retained from the scoring snapshot</p>
          </div>
          <span className="ranking-version-tag">CV · pages 1–2</span>
        </div>
        {evidence.length ? (
          <div className="evidence-list">
            {evidence.map(({ item, excerpt }) => (
              <div
                className="evidence-row"
                key={`${item.skillCode}-${excerpt.excerpt}`}
              >
                <span className="evidence-row__skill">{item.label}</span>
                <blockquote>“{excerpt.excerpt}”</blockquote>
                <span className="evidence-row__page">
                  {excerpt.pageNumber
                    ? `Page ${excerpt.pageNumber}`
                    : (excerpt.sectionLabel ?? "CV")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ranking-muted-text">
            No evidence excerpts were detected for this scoring snapshot.
          </p>
        )}
      </section>

      <p className="ranking-method-note">
        Automatic rubric: 75% required-skill evidence + 25% relevant experience.
        Preferred skills are evidence-only and do not add points.
      </p>
    </div>
  );
}

function LoaderPlaceholder() {
  return (
    <span className="ranking-empty-panel__icon" aria-hidden="true">
      <Minus />
    </span>
  );
}
