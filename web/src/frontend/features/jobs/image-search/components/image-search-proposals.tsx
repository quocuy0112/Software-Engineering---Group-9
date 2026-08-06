"use client";

import { useState } from "react";

import {
  searchIntentSchema,
  type SearchIntent,
} from "@/shared/contracts/jobs/search-intent";

function visibleValue(proposal: SearchIntent["proposals"][number]) {
  if (proposal.stringValue !== null) return proposal.stringValue;
  if (proposal.numberValue !== null) return String(proposal.numberValue);
  return proposal.stringValues.join(", ");
}

export function ImageSearchProposals({
  intent,
  onApply,
  onClear,
}: {
  intent: SearchIntent;
  onApply(intent: SearchIntent): void;
  onClear(): void;
}) {
  const [draft, setDraft] = useState(intent);
  const [error, setError] = useState("");
  const update = (id: string, value: string) =>
    setDraft((current) => ({
      ...current,
      proposals: current.proposals.map((proposal) => {
        if (proposal.id !== id) return proposal;
        if (proposal.numberValue !== null)
          return { ...proposal, numberValue: Number(value) };
        if (proposal.stringValue !== null)
          return { ...proposal, stringValue: value.slice(0, 200) };
        return {
          ...proposal,
          stringValues: value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 20),
        };
      }),
    }));
  return (
    <section aria-labelledby="image-search-proposals-heading">
      <h3 id="image-search-proposals-heading">Review suggested job filters</h3>
      <p>
        Every filter is optional. Edit, remove, or reverse selections before
        searching.
      </p>
      <ul className="image-search-proposals">
        {draft.proposals.map((proposal) => (
          <li key={proposal.id}>
            <label>
              <input
                type="checkbox"
                checked={proposal.selected}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    proposals: current.proposals.map((item) =>
                      item.id === proposal.id
                        ? { ...item, selected: event.target.checked }
                        : item,
                    ),
                  }))
                }
              />
              {proposal.field}
            </label>
            <input
              aria-label={`Edit ${proposal.field} proposal`}
              value={visibleValue(proposal)}
              onChange={(event) => update(proposal.id, event.target.value)}
            />
            <span
              className={`image-confidence image-confidence-${proposal.confidence >= 0.9 ? "high" : "review"}`}
            >
              {proposal.confidence >= 0.9
                ? "High confidence"
                : "Review suggested"}
            </span>
            <small>
              Source: {proposal.evidence.map((item) => item.text).join(" · ")}
            </small>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  proposals: current.proposals.filter(
                    (item) => item.id !== proposal.id,
                  ),
                }))
              }
            >
              Remove {proposal.field}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <div className="image-search-actions">
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              proposals: current.proposals.map((proposal) => ({
                ...proposal,
                selected: !proposal.selected,
              })),
            }))
          }
        >
          Reverse selections
        </button>
        <button
          type="button"
          onClick={() => setDraft({ ...draft, proposals: [] })}
        >
          Clear proposals
        </button>
        <button
          type="button"
          onClick={() => {
            const parsed = searchIntentSchema.safeParse({
              ...draft,
              proposals: draft.proposals.map((proposal) => ({
                ...proposal,
                selected: false,
              })),
            });
            if (!parsed.success) {
              setError("Review edited values before applying filters.");
              return;
            }
            setError("");
            onApply(draft);
          }}
        >
          Apply selected filters
        </button>
        <button type="button" onClick={onClear}>
          Close
        </button>
      </div>
    </section>
  );
}
