"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type {
  PrivateMatchResponse,
  PrivateMatchStatus,
} from "@/shared/contracts/private-cv-match";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { privateMatchCopy } from "../i18n/private-match-copy";
import {
  privateMatchErrorMessage,
  usePrivateCvMatch,
  useRetryPrivateCvMatch,
} from "../client/use-private-cv-match";
import { PrivateMatchReady } from "./private-match-ready";
import { PrivateMatchLimitedReport } from "./private-match-limited-report";
import { PrivateMatchReport } from "./private-match-report";
import {
  PrivateMatchAnalysisSteps,
  PrivateMatchPrivacyCard,
  PrivateMatchSelectedJobCard,
  PrivateMatchStatusBadge,
  PrivateMatchStepper,
} from "./private-match-shared";

function LoadingScreen({ data }: { data?: PrivateMatchStatus }) {
  const copy = privateMatchCopy(useWorkspaceLocale());
  const job = data?.job;
  return (
    <main className="private-match-page" aria-busy="true" aria-live="polite">
      <div className="private-match-breadcrumb">
        {copy.common.cvMatchCheck} <span>/</span> {copy.common.analysis}
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>{copy.pageStates.analyzingTitle}</h1>
          <p>{copy.pageStates.analyzingDescription}</p>
        </div>
        <PrivateMatchStatusBadge state="analyzing" />
      </div>
      <PrivateMatchStepper activeStep={2} />
      <section className="private-match-processing-banner">
        <span className="private-match-processing-spinner" aria-hidden="true">
          <LoaderCircle className="private-match-spin" />
        </span>
        <div>
          <span className="private-match-card-label">
            {copy.pageStates.processing}
          </span>
          <h2>{copy.pageStates.processingTitle}</h2>
          <p>{copy.pageStates.processingDescription}</p>
          <strong>{copy.pageStates.processingNote}</strong>
        </div>
      </section>
      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section className="private-match-card">
            <h2>{copy.pageStates.progressTitle}</h2>
            <p className="private-match-section-intro">
              {copy.pageStates.progressDescription}
            </p>
            <PrivateMatchAnalysisSteps
              activeStep={data?.state === "ANALYZING" ? 2 : 1}
            />
          </section>
        </div>
        <aside className="private-match-sidebar">
          <PrivateMatchSelectedJobCard job={job} />
          <section className="private-match-card">
            <h2>{copy.pageStates.nextTitle}</h2>
            <p>{copy.pageStates.nextDescription}</p>
          </section>
          <PrivateMatchPrivacyCard />
        </aside>
      </div>
    </main>
  );
}

function FailedScreen({ retryHref }: { retryHref: string }) {
  const copy = privateMatchCopy(useWorkspaceLocale());
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">
        {copy.common.cvMatchCheck} <span>/</span> {copy.common.analysis}
      </div>
      <section className="private-match-limit-card" role="alert">
        <TriangleAlert aria-hidden="true" />
        <div>
          <h1>{copy.pageStates.failedTitle}</h1>
          <p>{copy.pageStates.failedDescription}</p>
          <div className="private-match-state-actions">
            <Link className="private-match-primary-button" href={retryHref}>
              <RefreshCw aria-hidden="true" /> {copy.common.tryAgain}
            </Link>
            <Link
              className="private-match-secondary-button"
              href="/cv-match-check"
            >
              {copy.common.backToCheck}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function UnavailableScreen() {
  const copy = privateMatchCopy(useWorkspaceLocale());
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">
        {copy.common.cvMatchCheck} <span>/</span> {copy.common.report}
      </div>
      <section className="private-match-limit-card" role="status">
        <TriangleAlert aria-hidden="true" />
        <div>
          <h1>{copy.pageStates.unavailableTitle}</h1>
          <p>{copy.pageStates.unavailableDescription}</p>
          <div className="private-match-state-actions">
            <Link
              className="private-match-primary-button"
              href="/cv-match-check/new"
            >
              {copy.pageStates.startNew}
            </Link>
            <Link
              className="private-match-secondary-button"
              href="/cv-match-check"
            >
              {copy.common.backToCheck}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function NetworkErrorScreen({ onRetry }: { onRetry: () => void }) {
  const copy = privateMatchCopy(useWorkspaceLocale());
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">{copy.common.cvMatchCheck}</div>
      <section className="private-match-card private-match-empty" role="alert">
        <AlertCircle aria-hidden="true" />
        <h1>{copy.pageStates.loadErrorTitle}</h1>
        <p>{copy.pageStates.loadErrorDescription}</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={onRetry}
        >
          <RefreshCw aria-hidden="true" /> {copy.common.tryAgain}
        </button>
      </section>
    </main>
  );
}

export function PrivateMatchPageClient({ checkId }: { checkId: string }) {
  const locale = useWorkspaceLocale();
  const copy = privateMatchCopy(locale);
  const query = usePrivateCvMatch(checkId);
  const retry = useRetryPrivateCvMatch(checkId);
  const [opened, setOpened] = useState(false);
  const [retryRequested, setRetryRequested] = useState(false);
  const [retryWasRunning, setRetryWasRunning] = useState(false);
  const retrySubmissionInFlight = useRef(false);
  const data: PrivateMatchResponse | undefined = query.data;

  useEffect(() => {
    if (
      retryRequested &&
      data?.view === "LIMITED_REPORT" &&
      data.retryInProgress
    ) {
      setRetryWasRunning(true);
    }
  }, [data, retryRequested]);

  const retryAi = async () => {
    if (
      retrySubmissionInFlight.current ||
      retry.isPending ||
      (data?.view !== "STATUS" && data?.retryInProgress)
    ) {
      return;
    }
    retrySubmissionInFlight.current = true;
    setRetryRequested(true);
    setRetryWasRunning(false);
    try {
      await retry.mutateAsync();
    } catch {
      // The mutation error is rendered next to the retry control.
    } finally {
      retrySubmissionInFlight.current = false;
    }
  };

  if (query.isPending) return <LoadingScreen />;
  if (query.isError) {
    if (query.error instanceof Error && query.error.message === "UNAVAILABLE") {
      return <UnavailableScreen />;
    }
    return <NetworkErrorScreen onRetry={() => void query.refetch()} />;
  }
  if (!data) return <LoadingScreen />;
  if (data.view === "STATUS") {
    if (data.state === "FAILED") {
      const retryHref = `/cv-match-check/new?jobId=${encodeURIComponent(data.job.jobId)}&cvVersionId=${encodeURIComponent(data.cv.versionId)}`;
      return <FailedScreen retryHref={retryHref} />;
    }
    return <LoadingScreen data={data} />;
  }
  if (!opened) {
    return <PrivateMatchReady report={data} onOpen={() => setOpened(true)} />;
  }
  if (data.view === "LIMITED_REPORT") {
    return (
      <PrivateMatchLimitedReport
        checkId={checkId}
        report={data}
        onRetry={() => void retryAi()}
        retrying={retry.isPending}
        retryError={
          retry.error
            ? privateMatchErrorMessage(retry.error, locale)
            : retryRequested && retryWasRunning && !data.retryInProgress
              ? copy.pageStates.retryUnavailable
              : undefined
        }
      />
    );
  }
  return (
    <PrivateMatchReport
      checkId={checkId}
      report={data}
      onRetry={() => void retryAi()}
      retrying={retry.isPending}
      retryError={
        retry.error ? privateMatchErrorMessage(retry.error, locale) : undefined
      }
    />
  );
}

export { privateMatchErrorMessage };
