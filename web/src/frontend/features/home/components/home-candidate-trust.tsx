import { Search, ShieldCheck, Target, Zap, type LucideIcon } from "lucide-react";

import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

const trustIcons: Record<string, LucideIcon> = {
  transparency: Search,
  speed: Zap,
  relevance: Target,
  privacy: ShieldCheck,
};

function TrustIcon({ kind }: { kind: string }) {
  const Icon = trustIcons[kind] ?? Search;
  return <Icon aria-hidden="true" />;
}

export function HomeCandidateTrust({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale].candidateTrust;

  return (
    <section
      className="home-section home-candidate-trust"
      id="candidate-trust"
      aria-labelledby="candidate-trust-title"
    >
      <div className="home-section-heading">
        <p>{copy.eyebrow}</p>
        <h2 id="candidate-trust-title">{copy.title}</h2>
        <p className="home-section-description">{copy.description}</p>
      </div>
      <div className="home-candidate-trust-grid">
        {copy.cards.map((card) => (
          <article
            className={`home-candidate-trust-card home-candidate-trust-card--${card.tone}`}
            key={card.key}
          >
            <span className="home-candidate-trust-icon">
              <TrustIcon kind={card.key} />
            </span>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
