"use client";

import {
  Calculator,
  Check,
  CircleAlert,
  CircleX,
  FileSearch,
  Minus,
  Plus,
} from "lucide-react";
import type {
  AutomaticMatch,
  FinalScore,
  SkillEvidence,
} from "@/shared/contracts/scoring";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationDetailCopy } from "./application-detail-copy";

export function ScoringLineage({
  automatic,
}: {
  automatic: AutomaticMatch | null | undefined;
}) {
  const locale = useWorkspaceLocale();
  const copy = applicationDetailCopy(locale).automatic;
  if (!automatic)
    return (
      <span className="automatic-formula-row__lineage">
        {copy.lineagePreserved}
      </span>
    );

  return (
    <div
      className="automatic-formula-row__lineage"
      aria-label={copy.scoreInputs}
    >
      <span>
        <b>JD</b>
        <code>{automatic.jdVersion}</code>
      </span>
      <span>
        <b>CV</b>
        <code>{automatic.cvVersion}</code>
      </span>
      <span>
        <b>{copy.config}</b>
        <code>{automatic.configVersion}</code>
      </span>
    </div>
  );
}

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
  const copy = applicationDetailCopy(useWorkspaceLocale()).automatic;
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
        <span className="ranking-muted-text">{copy.noneDetected}</span>
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
  const locale = useWorkspaceLocale();
  const copy = applicationDetailCopy(locale).automatic;
  if (!automatic) {
    return (
      <div className="ranking-empty-panel" role="status">
        <LoaderPlaceholder />
        <h3>{copy.processingTitle}</h3>
        <p>{copy.processingDescription}</p>
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
    <div className="ranking-tab-content automatic-match-tab">
      <div className="automatic-score-cards" aria-label={copy.scoreComponents}>
        <ScoreCard
          title={copy.automaticMatch}
          value={`${automatic.score}/100`}
          meta={copy.weightAutomatic}
          tone="blue"
          progress={automatic.score}
        />
        <ScoreCard
          title={copy.aiAssessment}
          value={
            finalScore && aiScore !== null && aiScore !== undefined
              ? `${aiScore}/100`
              : retrying
                ? copy.processing
                : copy.unavailable
          }
          meta={copy.weightAi}
          tone="purple"
          progress={aiScore ?? 0}
        />
        <ScoreCard
          title={copy.finalScore}
          value={
            finalScore
              ? `${finalScore.value}/100`
              : retrying
                ? copy.pending
                : "—/100"
          }
          meta={copy.result}
          tone="green"
          progress={finalScore?.value ?? automatic.score}
        />
      </div>

      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon" aria-hidden="true">
          <Calculator />
        </span>
        <strong>
          {finalScore
            ? finalScore.formulaText
            : retrying
              ? copy.formulaRetry(automatic.score)
              : copy.formulaUnavailable(automatic.score)}
        </strong>
        <ScoringLineage automatic={automatic} />
      </div>

      {automatic.mayBeIncomplete ? (
        <div className="ranking-warning" role="status">
          <CircleAlert aria-hidden="true" />
          <span>{automatic.incompletenessLabel ?? copy.incomplete}</span>
        </div>
      ) : null}

      <div className="automatic-match-grid">
        <section className="ranking-panel automatic-skills-panel">
          <div className="ranking-section-heading">
            <h3>{copy.requiredSkills}</h3>
          </div>
          <SkillChips
            title={copy.foundInCv}
            items={automatic.foundRequiredSkills}
            tone="found"
            icon={Check}
          />
          <SkillChips
            title={copy.missingRequired}
            items={automatic.missingRequiredSkills}
            tone="missing"
            icon={CircleX}
          />
          <SkillChips
            title={copy.preferredSkills}
            items={automatic.preferredSkills}
            tone="preferred"
            icon={Plus}
          />
        </section>
        <section className="ranking-panel automatic-experience-panel">
          <div className="ranking-section-heading">
            <h3>{copy.experience}</h3>
          </div>
          <div className="experience-metric experience-metric--required">
            <span>{copy.minimumRequired}</span>
            <strong>
              {automatic.minimumExperienceYears === null
                ? copy.notSpecified
                : copy.years(automatic.minimumExperienceYears)}
            </strong>
          </div>
          <div className="experience-metric experience-metric--detected">
            <span>{copy.detectedInCv}</span>
            <strong>
              {automatic.detectedExperience.kind === "DETECTED"
                ? copy.years(automatic.detectedExperience.years)
                : copy.notDetected}
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
                ? copy.noMinimum
                : experienceDelta !== null && experienceDelta >= 0
                  ? copy.exceeds(experienceDelta)
                  : copy.minimumNotEstablished}
            </span>
          </div>
        </section>
      </div>

      <section className="ranking-panel evidence-panel">
        <div className="ranking-section-heading">
          <h3>
            <FileSearch aria-hidden="true" /> {copy.evidenceFound}
          </h3>
          <span className="ranking-version-tag">{copy.pages}</span>
        </div>
        {evidence.length ? (
          <div className="evidence-list">
            {evidence.map(({ item, excerpt }) => (
              <div
                className="evidence-row"
                key={`${item.skillCode}-${excerpt.excerpt}`}
              >
                <span className="evidence-row__skill">{item.label}</span>
                <blockquote>&ldquo;{excerpt.excerpt}&rdquo;</blockquote>
                <span className="evidence-row__page">
                  {excerpt.pageNumber
                    ? copy.page(excerpt.pageNumber)
                    : (excerpt.sectionLabel ?? copy.cv)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ranking-muted-text">{copy.noEvidence}</p>
        )}
      </section>
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
