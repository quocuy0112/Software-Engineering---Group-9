import { Eye, FileText, MailCheck, Sparkles, type LucideIcon } from "lucide-react";
import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";

const workflowIcons: Record<string, LucideIcon> = {
  profile: FileText,
  analysis: Sparkles,
  review: Eye,
  feedback: MailCheck,
};

function WorkflowIcon({ kind }: { kind: string }) {
  const Icon = workflowIcons[kind] ?? FileText;
  return <Icon aria-hidden="true" />;
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
