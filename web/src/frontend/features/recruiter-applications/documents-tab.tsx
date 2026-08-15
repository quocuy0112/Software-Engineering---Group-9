"use client";

import { useEffect, useState } from "react";
import type { AiAssessment, AutomaticMatch } from "@/shared/contracts/scoring";
import { ApplicationDocumentViewer } from "./application-document-viewer";

type Metadata = { cv: { available: boolean; fileName: string | null }; coverLetter: { kind: "NONE" | "TEXT" | "DOCUMENT"; fileName?: string | null } };

export function DocumentsTab({ jobId, applicationId, automatic, dataQualityNotes = [], openKind }: { jobId: string; applicationId: string; automatic?: AutomaticMatch | null; dataQualityNotes?: AiAssessment["dataQualityNotes"]; openKind?: "cv" | "cover-letter" | null }) {
  const [viewer, setViewer] = useState<"cv" | "cover-letter" | null>(openKind ?? null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications?limit=100`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("metadata unavailable")))
      .then((page: { items?: Array<Metadata & { applicationId: string }> }) => { if (!cancelled) setMetadata(page.items?.find((item) => item.applicationId === applicationId) ?? null); })
      .catch(() => { if (!cancelled) setMetadata(null); });
    return () => { cancelled = true; };
  }, [applicationId, jobId]);
  const parse = automatic?.cvParse;
  const parsingWarning = automatic?.mayBeIncomplete ?? false;
  const coverAvailable = metadata?.coverLetter.kind === "DOCUMENT" || metadata?.coverLetter.kind === "TEXT";
  return <div className="ai-ranking-documents-tab"><div className={"ai-ranking-parser-status " + ((parsingWarning || dataQualityNotes.length > 0) ? "ai-ranking-parser-status--warning" : "")}><span aria-hidden="true">{parsingWarning || dataQualityNotes.length > 0 ? "!" : String.fromCharCode(10003)}</span><div><strong>{parse?.label ?? "Parsing status unavailable"}{parse ? ` - ${parse.parserVersion}` : ""}</strong>{parse ? <span>{parse.processingMilliseconds}ms - {parse.snapshotVersion}</span> : null}{parsingWarning ? <p>Automatic and AI scores may be incomplete because parsing reported an issue.</p> : null}</div></div>{dataQualityNotes.length > 0 ? <section className="ai-ranking-data-quality" role="status"><h3>CV data quality notes</h3><p>These are parsing/input limitations, not candidate-fit findings.</p><ul>{dataQualityNotes.map((note) => <li key={note.id}><strong>{note.title}</strong><span>{note.bucket === "input_limitation" ? "Input limitation" : "Extraction uncertainty"} — {note.evidence}</span></li>)}</ul></section> : null}<div className="ai-ranking-document-grid">{metadata?.cv.available !== false ? <DocumentCard title="Original CV" fileName={metadata?.cv.fileName ?? "Candidate CV"} onOpen={() => setViewer("cv")} /> : null}{coverAvailable ? <DocumentCard title="Cover letter" fileName={metadata?.coverLetter.fileName ?? (metadata?.coverLetter.kind === "TEXT" ? "Submitted cover letter" : "Cover letter")} onOpen={() => setViewer("cover-letter")} /> : <p>Cover letter not provided.</p>}</div><div className="ai-ranking-documents-note">Use the original submitted documents to verify scoring evidence.</div>{viewer ? <ApplicationDocumentViewer jobId={jobId} applicationId={applicationId} kind={viewer} fileName={viewer === "cv" ? metadata?.cv.fileName : metadata?.coverLetter.fileName} onClose={() => setViewer(null)} /> : null}</div>;
}

function DocumentCard({ title, fileName, onOpen }: { title: string; fileName: string; onOpen: () => void }) {
  return <article className="ai-ranking-document-card"><header><div><h3>{title}</h3><span>{fileName}</span></div></header><button type="button" className="ai-ranking-document-preview" onClick={onOpen}><span className="ai-ranking-document-page"><strong>{title === "Original CV" ? "CV" : "Cover letter"}</strong><i /><i /><i /><i /></span><span>Open original</span></button></article>;
}
