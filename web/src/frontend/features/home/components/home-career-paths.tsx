import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeCareerPaths({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-section home-career-paths" aria-labelledby="career-paths">
      <div className="home-section-heading"><p>{copy.careerPaths.eyebrow}</p><h2 id="career-paths">{copy.careerPaths.title}</h2></div>
      <div className="home-path-grid">
        {copy.careerPaths.cards.map((path, index) => (
          <article className="home-path-card" key={path.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{path.title}</h3><p>{path.body}</p><small>{copy.common.displayOnly}</small></article>
        ))}
      </div>
    </section>
  );
}
