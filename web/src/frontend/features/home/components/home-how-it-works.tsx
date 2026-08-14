import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

function WorkflowIcon({ kind }: { kind: string }) {
  if (kind === "analysis") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3 1.25 4.01L17.25 8.25l-4 1.24L12 13.5l-1.25-4.01-4-1.24 4-1.24L12 3Z" />
        <path d="m18.25 13.25.77 2.23 2.23.77-2.23.77-.77 2.23-.77-2.23-2.23-.77 2.23-.77.77-2.23Z" />
        <path d="m5.25 14.25.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
      </svg>
    );
  }

  if (kind === "review") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3.5 12s3.15-5.25 8.5-5.25S20.5 12 20.5 12 17.35 17.25 12 17.25 3.5 12 3.5 12Z" />
        <circle cx="12" cy="12" r="2.4" />
      </svg>
    );
  }

  if (kind === "feedback") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5.5h16v13H4z" />
        <path d="m4.5 7 7.5 5.5L19.5 7" />
        <path d="M16.5 3.5h3v3" />
        <path d="m19.5 3.5-4.2 4.2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6.5 3.5h7.1l3.9 3.9v13.1H6.5z" />
      <path d="M13.5 3.8v4h4" />
      <path d="M9 14.75h3.25" />
      <path d="m14.1 12.8 2.4 2.4" />
      <path d="m13.7 16 3.45-3.45 1.15 1.15-3.45 3.45-1.55.4z" />
    </svg>
  );
}

export function HomeHowItWorks({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale].howItWorks;

  return (
    <section
      className="home-section home-how-it-works"
      id="how-it-works"
      aria-labelledby="how-it-works-title"
    >
      <div className="home-section-heading">
        <p>{copy.eyebrow}</p>
        <h2 id="how-it-works-title">{copy.title}</h2>
        <p className="home-section-description">{copy.description}</p>
      </div>
      <ol className="home-process-list">
        {copy.steps.map((step, index) => (
          <li
            className={`home-process-step home-process-step--${step.tone}`}
            key={step.key}
          >
            {index > 0 ? <span className="home-process-connector" aria-hidden="true" /> : null}
            <span className="home-process-icon">
              <WorkflowIcon kind={step.key} />
            </span>
            <p className="home-process-label">{step.label}</p>
            <h3>{step.title}</h3>
            <p className="home-process-description">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
