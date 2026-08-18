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
  const job = data?.job;
  return (
    <main className="private-match-page" aria-busy="true" aria-live="polite">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> Analysis
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>Analyzing your CV</h1>
          <p>
            SmartHire is comparing the selected CV with the job requirements.
          </p>
        </div>
        <PrivateMatchStatusBadge state="analyzing" />
      </div>
      <PrivateMatchStepper activeStep={2} />
      <section className="private-match-processing-banner">
        <span className="private-match-processing-spinner" aria-hidden="true">
          <LoaderCircle className="private-match-spin" />
        </span>
        <div>
          <span className="private-match-card-label">PROCESSING</span>
          <h2>SmartHire is checking your CV evidence</h2>
          <p>
            This private analysis compares skills, experience and evidence with
            the selected job. It does not change your profile or application.
          </p>
          <strong>
            You can leave this page — we&apos;ll save the result when it&apos;s
            ready.
          </strong>
        </div>
      </section>
      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section className="private-match-card">
            <h2>Analysis progress</h2>
            <p className="private-match-section-intro">
              Each stage completes safely before the report is published.
            </p>
            <PrivateMatchAnalysisSteps
              activeStep={data?.state === "ANALYZING" ? 2 : 1}
            />
          </section>
        </div>
        <aside className="private-match-sidebar">
          <PrivateMatchSelectedJobCard job={job} />
          <section className="private-match-card">
            <h2>What happens next</h2>
            <p>
              When the analysis is complete, you can review the preview before
              choosing whether to apply.
            </p>
          </section>
          <PrivateMatchPrivacyCard />
        </aside>
      </div>
    </main>
  );
}

function FailedScreen({ retryHref }: { retryHref: string }) {
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> Analysis
      </div>
      <section className="private-match-limit-card" role="alert">
        <TriangleAlert aria-hidden="true" />
        <div>
          <h1>We could not finish this private check</h1>
          <p>
            The report was not published because the source evidence could not
            be analyzed safely.
          </p>
          <div className="private-match-state-actions">
            <Link className="private-match-primary-button" href={retryHref}>
              <RefreshCw aria-hidden="true" /> Try again
            </Link>
            <Link
              className="private-match-secondary-button"
              href="/cv-match-check"
            >
              Back to CV Match Check
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function UnavailableScreen() {
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> Report
      </div>
      <section className="private-match-limit-card" role="status">
        <TriangleAlert aria-hidden="true" />
        <div>
          <h1>This match check is no longer available.</h1>
          <p>This private preview can no longer be opened.</p>
          <div className="private-match-state-actions">
            <Link
              className="private-match-primary-button"
              href="/cv-match-check/new"
            >
              Start a new check
            </Link>
            <Link
              className="private-match-secondary-button"
              href="/cv-match-check"
            >
              Back to CV Match Check
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function NetworkErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="private-match-page private-match-state-page">
      <div className="private-match-breadcrumb">CV Match Check</div>
      <section className="private-match-card private-match-empty" role="alert">
        <AlertCircle aria-hidden="true" />
        <h1>We could not load this report</h1>
        <p>Please try again. Your private preview has not been changed.</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={onRetry}
        >
          <RefreshCw aria-hidden="true" /> Try again
        </button>
      </section>
    </main>
  );
}

export function PrivateMatchPageClient({ checkId }: { checkId: string }) {
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
            ? privateMatchErrorMessage(retry.error)
            : retryRequested && retryWasRunning && !data.retryInProgress
              ? "AI evaluation is still unavailable. Your deterministic report remains available; try again later."
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
        retry.error ? privateMatchErrorMessage(retry.error) : undefined
      }
    />
  );
}

export { privateMatchErrorMessage };
