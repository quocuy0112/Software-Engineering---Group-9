import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeWhatsNew({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-section home-community" id="community" aria-labelledby="whats-new">
      <div className="home-section-heading"><p>{copy.whatsNew.eyebrow}</p><h2 id="whats-new">{copy.whatsNew.title}</h2></div>
      <div className="home-feed-grid">
        {copy.whatsNew.cards.slice(0, 3).map((item) => (
          <article className="home-feed-card" key={item.type}>
            <span>{item.label}</span><h3>{item.title}</h3><p>{item.body}</p><small>{copy.common.displayOnly}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
