"use client";

import { useEffect, useId, useState } from "react";

const ringCircumference = 534.1;

export type HomeMatchBreakdownItem = Readonly<{
  key:
    | "skills"
    | "roleAndSkills"
    | "preferences"
    | "experience"
    | "education"
    | "unmatched"
    | "incomplete";
  label: string;
  value: number;
}>;

function useAnimatedScore(score: number) {
  const [value, setValue] = useState(0);
  const [ringDrawn, setRingDrawn] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let startFrame = 0;
    let frame = 0;
    if (reducedMotion) {
      startFrame = window.requestAnimationFrame(() => {
        setValue(score);
        setRingDrawn(true);
      });
      return () => window.cancelAnimationFrame(startFrame);
    }

    startFrame = window.requestAnimationFrame(() => {
      setValue(0);
      setRingDrawn(false);
      frame = window.requestAnimationFrame(() => {
        const startedAt = performance.now();
        setRingDrawn(true);
        const tick = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / 1600);
          const eased = 1 - (1 - progress) ** 3;
          setValue(Math.round(score * eased));
          if (progress < 1) frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
      });
    });
    return () => {
      window.cancelAnimationFrame(startFrame);
      window.cancelAnimationFrame(frame);
    };
  }, [score]);

  return { value, ringDrawn };
}

export function HomeMatchRing({
  score,
  size,
  label,
  scoreSuffix,
  state = "filled",
}: {
  score?: number;
  size: "large" | "small";
  label: string;
  scoreSuffix: string;
  state?: "filled" | "ghost";
}) {
  const gradientId = useId().replaceAll(":", "");
  const resolvedScore = score ?? 0;
  const { value, ringDrawn } = useAnimatedScore(resolvedScore);
  const ringOffset = ringDrawn
    ? ringCircumference * (1 - resolvedScore / 100)
    : ringCircumference;

  return (
    <div
      className={`home-match-score home-match-ring home-match-ring--${size} home-match-ring--${state}`}
      role="img"
      aria-label={label}
    >
      {state === "filled" ? (
        <>
          <span className="home-match-score-glow" aria-hidden="true" />
          <span className="home-match-score-orbit" aria-hidden="true" />
        </>
      ) : null}
      <svg
        className="home-match-score-ring"
        viewBox="0 0 186 186"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <circle className="home-match-score-track" cx="93" cy="93" r="85" />
        {state === "filled" ? (
          <circle
            className="home-match-score-progress"
            cx="93"
            cy="93"
            r="85"
            stroke={`url(#${gradientId})`}
            style={{
              strokeDasharray: ringCircumference,
              strokeDashoffset: ringOffset,
            }}
          />
        ) : (
          <circle className="home-match-score-ghost" cx="93" cy="93" r="85" />
        )}
      </svg>
      {state === "filled" ? (
        <>
          <span className="home-match-score-value" aria-hidden="true">
            {value}%
          </span>
          <span className="home-match-score-label" aria-hidden="true">
            {scoreSuffix}
          </span>
        </>
      ) : (
        <span className="home-match-score-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M7.5 10V7.25a4.5 4.5 0 0 1 9 0V10" />
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M12 14v2" />
          </svg>
        </span>
      )}
    </div>
  );
}

export function HomeMatchBreakdown({
  items,
  size,
  label,
}: {
  items: readonly HomeMatchBreakdownItem[];
  size: "large" | "small";
  label: string;
}) {
  return (
    <div
      className={`home-match-breakdown-visual home-match-breakdown-visual--${size}`}
    >
      <div className="home-match-stackbar" role="group" aria-label={label}>
        {items.map((item) => (
          <button
            className={`home-match-stack-segment home-match-stack-segment--${item.key}`}
            type="button"
            key={item.key}
            aria-label={`${item.label}: ${item.value}%`}
            data-tooltip={`${item.label}: ${item.value}%`}
            style={{ flexBasis: `${item.value}%` }}
          />
        ))}
      </div>
      <ul className="home-match-legend" aria-label={label}>
        {items.map((item) => (
          <li key={item.key} className={`home-match-legend--${item.key}`}>
            <span aria-hidden="true" />
            {item.label} {item.value}%
          </li>
        ))}
      </ul>
    </div>
  );
}
