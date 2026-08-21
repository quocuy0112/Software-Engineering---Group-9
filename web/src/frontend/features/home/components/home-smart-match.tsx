"use client";

import { useId } from "react";
import { homeCopy } from "../home-copy";
import { illustrativeSmartMatch } from "../home-display-data";
import type { HomeLocale, HomePageModel } from "../home-page-model";
import {
  HomeMatchBreakdown,
  HomeMatchRing,
  type HomeMatchBreakdownItem,
} from "./home-match-visuals";

function splitIllustrativeComposition(score: number) {
  const skills = Math.round(score * 0.46);
  const experience = Math.round(score * 0.34);
  const education = Math.max(0, score - skills - experience);
  return [skills, experience, education, Math.max(0, 100 - score)] as const;
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m10 1.9 1.67 5.16L16.8 8.7l-5.13 1.64L10 15.5l-1.67-5.16L3.2 8.7l5.13-1.64L10 1.9Z" />
      <path d="m16.3 12.3.7 2.13 2.1.67-2.1.68-.7 2.12-.68-2.12-2.1-.68 2.1-.67.68-2.13Z" />
    </svg>
  );
}

function MatchIdentity({
  symbol,
  name,
  label,
  kind,
}: {
  symbol: string;
  name: string;
  label: string;
  kind: "candidate" | "role";
}) {
  return (
    <div className={`home-match-identity home-match-identity--${kind}`}>
      <span className="home-match-identity-symbol" aria-hidden="true">
        {symbol}
      </span>
      <div className="home-match-identity-copy">
        <strong>{name}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

export function HomeSmartMatch({
  model,
  locale,
}: {
  model: HomePageModel;
  locale: HomeLocale;
}) {
  // This panel explains the feature. Candidate-specific scores stay beside
  // their job, where the score source and private report can be reviewed.
  void model;
  const match = illustrativeSmartMatch(locale);
  const copy = homeCopy[locale];
  const connectorGradientId = useId().replaceAll(":", "");
  const composition = splitIllustrativeComposition(match.score);
  const segments: readonly HomeMatchBreakdownItem[] = [
    {
      key: "skills",
      label: copy.smartMatch.skillsContribution,
      value: composition[0],
    },
    {
      key: "experience",
      label: copy.smartMatch.experienceContribution,
      value: composition[1],
    },
    {
      key: "education",
      label: copy.smartMatch.educationContribution,
      value: composition[2],
    },
    {
      key: "incomplete",
      label: copy.smartMatch.insufficientData,
      value: composition[3],
    },
  ];
  const explanation = [
    copy.smartMatch.illustrativeLimitation,
    copy.smartMatch.decisionNotice,
  ].join(" ");

  return (
    <section
      className="home-section home-smart-match home-smart-match-v2 home-smart-match--illustrative"
      id="smart-match"
      aria-labelledby="smart-match-title"
    >
      <div className="home-smart-match-badge">
        <SparkleIcon />
        <span>{copy.smartMatch.badge}</span>
      </div>
      <div className="home-smart-match-visual">
        <div className="home-smart-match-intro">
          <p>{copy.smartMatch.eyebrow}</p>
          <h2 id="smart-match-title">{copy.smartMatch.title}</h2>
        </div>
        <div className="home-match-visual-stage">
          <div className="home-match-identities">
            <MatchIdentity
              kind="candidate"
              symbol={copy.smartMatch.candidateToken}
              name={copy.smartMatch.illustrativeCandidateName}
              label={copy.smartMatch.candidateLabel}
            />
            <MatchIdentity
              kind="role"
              symbol={copy.smartMatch.roleToken}
              name={copy.smartMatch.illustrativeJobTitle}
              label={copy.smartMatch.roleLabel}
            />
          </div>
          <svg
            className="home-match-connectors"
            viewBox="0 0 340 250"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient
                id={connectorGradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <path
              d="M55 32C110 32 130 110 170 150"
              stroke={`url(#${connectorGradientId})`}
            />
            <path
              d="M285 32C230 32 210 110 170 150"
              stroke={`url(#${connectorGradientId})`}
            />
          </svg>
          <HomeMatchRing
            score={match.score}
            size="large"
            label={copy.smartMatch.scoreLabel.replace(
              "{score}",
              String(match.score),
            )}
            scoreSuffix={copy.smartMatch.scoreSuffix}
          />
        </div>
        <p className="home-match-caption">
          {copy.smartMatch.illustrativeCaption}
        </p>
      </div>
      <div className="home-smart-match-breakdown">
        <h3>{copy.smartMatch.compositionTitle}</h3>
        <HomeMatchBreakdown
          items={segments}
          size="large"
          label={copy.smartMatch.compositionTitle}
        />
        <div className="home-match-insights">
          <div className="home-match-insight home-match-insight--strength">
            <span aria-hidden="true" />
            <div>
              <h3>{copy.smartMatch.matchingSkills}</h3>
              <p>{copy.smartMatch.illustrativeSkills.join(" · ")}</p>
            </div>
          </div>
          <div className="home-match-insight home-match-insight--improvement">
            <span aria-hidden="true" />
            <div>
              <h3>{copy.smartMatch.improvementAreas}</h3>
              <p>{copy.smartMatch.illustrativeAreas.join(" · ")}</p>
            </div>
          </div>
        </div>
        <p className="home-match-disclaimer">
          <span aria-hidden="true" />
          {explanation}
        </p>
      </div>
    </section>
  );
}
