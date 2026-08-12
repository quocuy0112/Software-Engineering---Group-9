import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeGrowthHub({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-section home-growth" aria-labelledby="growth-hub">
      <div className="home-section-heading"><p>{copy.growth.eyebrow}</p><h2 id="growth-hub">{copy.growth.title}</h2></div>
      <div className="home-growth-grid">
        {copy.growth.cards.map((item) => <article className="home-growth-card" key={item.title}><h3>{item.title}</h3><p>{item.body}</p><small>{copy.common.displayOnly}</small></article>)}
      </div>
    </section>
  );
}
