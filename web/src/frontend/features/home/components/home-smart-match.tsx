import { homeCopy } from "../home-copy";
import type { HomeLocale, HomePageModel } from "../home-page-model";

export const smartMatchExplanationId = (jobSlug: string) => `smart-match-explanation-${jobSlug}`;

export function HomeSmartMatch({ model, locale }: { model: HomePageModel; locale: HomeLocale }) {
  const match = model.smartMatch;
  const copy = homeCopy[locale];
  const matchingSkills = match.kind === "personal" ? match.matchingSkills : copy.smartMatch.illustrativeSkills;
  const improvementAreas = match.kind === "personal" ? match.improvementAreas : copy.smartMatch.illustrativeAreas;
  return (
    <section className={`home-section home-smart-match home-smart-match--${match.kind}`} aria-labelledby="smart-match">
      <div className="home-smart-match-intro">
        <p>{copy.smartMatch.eyebrow}</p><h2 id="smart-match">{copy.smartMatch.title}</h2>
        <p>{match.kind === "personal" ? copy.smartMatch.personal : copy.smartMatch.illustrative}</p>
        {match.kind === "personal" ? <p>{match.jobTitle}</p> : null}
      </div>
      <div className="home-match-score"><strong>{match.score}%</strong><span>{match.kind === "personal" ? copy.smartMatch.personalScore : copy.smartMatch.sampleScore}</span></div>
      <div className="home-smart-match-details" id={match.kind === "personal" ? smartMatchExplanationId(match.jobSlug) : undefined}>
        <h3>{copy.smartMatch.matchingSkills}</h3><p>{matchingSkills.join(" · ")}</p>
        <h3>{copy.smartMatch.improvementAreas}</h3><p>{improvementAreas.join(" · ")}</p>
        <h3>{copy.smartMatch.limitations}</h3>
        <ul>
          <li>{match.kind === "personal" ? copy.smartMatch.profileLimitation : copy.smartMatch.illustrativeLimitation}</li><li>{copy.smartMatch.estimateLimitation}</li>
        </ul>
        <small>{copy.smartMatch.decisionNotice}</small>
      </div>
    </section>
  );
}
