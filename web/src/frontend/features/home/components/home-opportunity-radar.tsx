import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

/**
 * A purely presentational signal map for the hero. It intentionally uses
 * curated labels only: no visitor profile, score, or employer data appears in
 * this illustration.
 */
export function HomeOpportunityRadar({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  const visualPath = copy.careerPaths.cards[0];
  const visualSkill = copy.smartMatch.illustrativeSkills[0];

  return (
    <div className="home-opportunity-radar" aria-hidden="true">
      <div className="home-radar-stage">
        <span className="home-radar-orbit home-radar-orbit--outer" />
        <span className="home-radar-orbit home-radar-orbit--middle" />
        <span className="home-radar-orbit home-radar-orbit--inner" />
        <span className="home-radar-axis home-radar-axis--one" />
        <span className="home-radar-axis home-radar-axis--two" />
        <span className="home-radar-marker home-radar-marker--one">S</span>
        <span className="home-radar-marker home-radar-marker--two">H</span>
        <span className="home-radar-marker home-radar-marker--three">+</span>
        <span className="home-radar-core"><span /></span>

        <div className="home-radar-job-card">
          <span>{copy.jobs.eyebrow}</span>
          <strong>{visualPath.title}</strong>
          <small>{visualSkill}</small>
        </div>

        <div className="home-radar-match">
          <span>{copy.smartMatch.sampleScore}</span>
          <i><b /><b /><b /></i>
        </div>
      </div>
    </div>
  );
}
