import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

function TrustIcon({ kind }: { kind: string }) {
  if (kind === "speed") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m13.5 2.75-8 10.05h5.65l-.65 8.45 8-10.05h-5.65l.65-8.45Z" />
      </svg>
    );
  }

  if (kind === "relevance") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7.75" />
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 2v3" />
        <path d="M22 12h-3" />
        <path d="M12 22v-3" />
        <path d="M2 12h3" />
      </svg>
    );
  }

  if (kind === "privacy") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3.25 19 6v5.25c0 4.65-2.9 7.85-7 9.5-4.1-1.65-7-4.85-7-9.5V6l7-2.75Z" />
        <rect x="8.5" y="10.5" width="7" height="5.5" rx="1" />
        <path d="M10 10.5V9.25a2 2 0 0 1 4 0v1.25" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="m15 15 4.25 4.25" />
      <path d="M8 10.5h5" />
      <path d="M10.5 8v5" />
    </svg>
  );
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
