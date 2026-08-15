"use client";

import type { AutomaticMatch, FinalScore } from "@/shared/contracts/scoring";

function SkillGroup({ title, items, tone, icon }: { title: string; items: AutomaticMatch["foundRequiredSkills"]; tone: "found" | "missing" | "preferred"; icon: string }) {
  return <section className={"ai-ranking-skill-group ai-ranking-skill-group--" + tone}><h3><span aria-hidden="true">{icon}</span>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item.requirementKind + "-" + item.skillCode}><strong>{item.label}</strong>{item.evidence.length ? <span>{item.evidence[0]?.excerpt}</span> : <span>No evidence found in the CV.</span>}</li>)}</ul> : <p className="ai-ranking-muted">None detected.</p>}</section>;
}

export function AutomaticMatchTab({ automatic, finalScore, retrying = false }: { automatic: AutomaticMatch | null; finalScore: FinalScore | null; retrying?: boolean }) {
  if (!automatic) return <div className="ai-ranking-empty-panel" role="status"><span aria-hidden="true">{String.fromCharCode(8635)}</span><h3>Automatic match is processing</h3><p>The deterministic result will appear here when the CV and job snapshots are ready.</p></div>;
  return (
    <div className="ai-ranking-tab-content">
      <div className="ai-ranking-score-cards" aria-label="Score components">
        <article><span>Automatic match</span><strong>{automatic.score}</strong><small>60% weight</small></article>
        <article><span>AI assessment</span><strong>{finalScore ? "Ready" : retrying ? "Processing" : "Unavailable"}</strong><small>40% weight</small></article>
        <article><span>Final score</span><strong>{finalScore ? finalScore.value : String.fromCharCode(8212)}</strong><small>{finalScore ? finalScore.band.label : retrying ? "Pending" : "Not calculated"}</small></article>
      </div>
      <div className="ai-ranking-formula-row"><strong>{finalScore ? finalScore.formulaText : retrying ? "Deterministic " + automatic.score + " ready - AI retry in progress" : "Deterministic match: " + automatic.score + "/100 - AI unavailable"}</strong><span>JD {automatic.jdVersion} - CV {automatic.cvVersion} - Config {automatic.configVersion}</span></div>
      {automatic.mayBeIncomplete ? <div className="ai-ranking-warning" role="status"><span aria-hidden="true">!</span>{automatic.incompletenessLabel}</div> : null}
      <div className="ai-ranking-skill-grid"><SkillGroup title="Skills found" items={automatic.foundRequiredSkills} tone="found" icon={String.fromCharCode(10003)} /><SkillGroup title="Missing required skills" items={automatic.missingRequiredSkills} tone="missing" icon={String.fromCharCode(10005)} /></div>
      <SkillGroup title="Preferred skills" items={automatic.preferredSkills} tone="preferred" icon="+" />
      <section className="ai-ranking-evidence-block">
        <div className="ai-ranking-section-title"><h3>Experience</h3><span>Deterministic evidence</span></div>
        <div className="ai-ranking-experience-grid"><div><span>Minimum required</span><strong>{automatic.minimumExperienceYears === null ? "Not specified" : automatic.minimumExperienceYears + " years"}</strong></div><div><span>Years detected in CV</span><strong>{automatic.detectedExperience.kind === "DETECTED" ? automatic.detectedExperience.years + " years" : "Not detected"}</strong></div></div>
        <p>{automatic.detectedExperience.kind === "DETECTED" && automatic.minimumExperienceYears !== null ? automatic.detectedExperience.years >= automatic.minimumExperienceYears ? "Exceeds the requirement by " + Math.max(0, automatic.detectedExperience.years - automatic.minimumExperienceYears) + " year" + (automatic.detectedExperience.years - automatic.minimumExperienceYears === 1 ? "" : "s") + "." : "Does not yet meet the minimum experience requirement." : "Experience could not be established from the CV; no number was inferred."}</p>
      </section>
      <section className="ai-ranking-evidence-block"><div className="ai-ranking-section-title"><h3>Evidence found in the CV</h3><span>Verbatim excerpts</span></div><div className="ai-ranking-evidence-list">{[...automatic.foundRequiredSkills, ...automatic.preferredSkills].flatMap((item) => item.evidence.map((evidence) => <blockquote key={item.skillCode + "-" + evidence.excerpt}><p>&quot;{evidence.excerpt}&quot;</p><cite>{item.label} - {evidence.pageNumber ? "Page " + evidence.pageNumber : evidence.sectionLabel}</cite></blockquote>))}{![...automatic.foundRequiredSkills, ...automatic.preferredSkills].some((item) => item.evidence.length) ? <p className="ai-ranking-muted">No evidence excerpts were detected.</p> : null}</div></section>
    </div>
  );
}
