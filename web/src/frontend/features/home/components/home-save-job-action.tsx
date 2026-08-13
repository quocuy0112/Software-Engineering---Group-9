"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { homeCopy } from "../home-copy";
import type { HomeLocale } from "../home-page-model";
import { HomeAuthRequiredFeedback } from "./home-auth-required-feedback";

export function HomeSaveJobAction({ jobId, slug, initialSaved, csrfProof, locale }: { jobId: string; slug: string; initialSaved: boolean; csrfProof?: string; locale: HomeLocale }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ role: "status" | "alert"; message: string }>();
  const copy = homeCopy[locale];
  if (!csrfProof) return <HomeAuthRequiredFeedback returnTo={`/jobs/${slug}`} label={copy.common.accountRequired} />;
  const proof = csrfProof;
  async function toggle() {
    if (pending) return;
    const before = saved;
    setPending(true);
    setFeedback(undefined);
    setSaved(!before);
    try {
      const response = await mutateWithCurrentCsrf(`/api/saved-jobs/${encodeURIComponent(jobId)}`, { method: before ? "DELETE" : "PUT" }, proof);
      if (response.status === 401) {
        setSaved(before);
        router.replace("/");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("SAVE_FAILED");
      setFeedback({ role: "status", message: before ? copy.jobs.removeSuccess : copy.jobs.saveSuccess });
    } catch {
      setSaved(before);
      setFeedback({ role: "alert", message: copy.jobs.saveError });
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="home-save-action">
      <button className="home-save-button" type="button" aria-pressed={saved} disabled={pending} onClick={() => void toggle()}>
        {pending ? copy.jobs.saving : saved ? copy.jobs.saved : copy.jobs.save}
      </button>
      {feedback ? <span className="home-action-feedback" role={feedback.role}>{feedback.message}</span> : null}
    </span>
  );
}
