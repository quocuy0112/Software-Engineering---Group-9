"use client";

import { useRouter } from "next/navigation";
import type { HomeSectionState } from "../home-page-model";

export function HomeSectionStateView({
  state,
  labels,
}: {
  state: HomeSectionState<unknown>;
  labels: { loading: string; empty: string; error: string; reloadHome: string };
}) {
  const router = useRouter();
  if (state.status === "loading")
    return <div className="home-section-state" aria-busy="true">{labels.loading}</div>;
  if (state.status === "error")
    return (
      <div className="home-section-state" role="status">
        <p>{labels.error}</p>
        <button type="button" onClick={() => router.refresh()}>{labels.reloadHome}</button>
      </div>
    );
  if (state.status === "empty") return <div className="home-section-state">{labels.empty}</div>;
  return null;
}
