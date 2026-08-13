import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

export function HomeCareerEvents({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <section className="home-section home-events" id="events" aria-labelledby="career-events">
      <div className="home-section-heading"><p>{copy.events.eyebrow}</p><h2 id="career-events">{copy.events.title}</h2></div>
      <div className="home-events-grid">
        {copy.events.cards.map((item) => <article className="home-event-card" key={item.title}><h3>{item.title}</h3><p>{item.body}</p><small>{copy.common.displayOnly}</small></article>)}
      </div>
    </section>
  );
}
