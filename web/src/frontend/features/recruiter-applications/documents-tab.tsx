"use client";

import { useState } from "react";
import { ApplicationDocumentViewer } from "./application-document-viewer";

export function DocumentsTab({ jobId, applicationId, parsingWarning = false, openKind }: { jobId: string; applicationId: string; parsingWarning?: boolean; openKind?: "cv" | "cover-letter" | null }) {
  const [viewer, setViewer] = useState<"cv" | "cover-letter" | null>(openKind ?? null);
  return <div className="ai-ranking-documents-tab"><div className={"ai-ranking-parser-status " + (parsingWarning ? "ai-ranking-parser-status--warning" : "")}><span aria-hidden="true">{parsingWarning ? "!" : String.fromCharCode(10003)}</span><div><strong>{parsingWarning ? "Parsed with errors" : "Parsed successfully"} - Parser v2.4</strong><span>Processing time 1.8s - CV snapshot v1 - JD v3</span>{parsingWarning ? <p>Automatic and AI scores may be incomplete because parsing reported an issue.</p> : null}</div></div><div className="ai-ranking-document-grid"><DocumentCard title="Original CV" fileName="Nguyen-Minh-Anh-CV.pdf" onOpen={() => setViewer("cv")} /><DocumentCard title="Cover letter" fileName="Nguyen-Minh-Anh-Cover-Letter.pdf" onOpen={() => setViewer("cover-letter")} /></div><div className="ai-ranking-documents-note">Use this preview to verify evidence. Select &quot;View original CV&quot; or &quot;View cover letter&quot; to open the full file.</div>{viewer ? <ApplicationDocumentViewer jobId={jobId} applicationId={applicationId} kind={viewer} onClose={() => setViewer(null)} /> : null}</div>;
}

function DocumentCard({ title, fileName, onOpen }: { title: string; fileName: string; onOpen: () => void }) {
  return <article className="ai-ranking-document-card"><header><div><h3>{title}</h3><span>{fileName}</span></div><button type="button" aria-label={"More actions for " + title}>...</button></header><button type="button" className="ai-ranking-document-preview" onClick={onOpen}><span className="ai-ranking-document-page"><strong>{title === "Original CV" ? "CV" : "Cover letter"}</strong><i /><i /><i /><i /></span><span>Open original</span></button>{title === "Cover letter" ? <div className="ai-ranking-keywords"><strong>Detected keywords</strong><span>Java</span><span>Spring Boot</span><span>PostgreSQL</span></div> : null}</article>;
}
