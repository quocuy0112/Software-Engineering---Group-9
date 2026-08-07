"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableChipOption = {
  value: string;
  label: string;
  keywords?: string[];
};

export function SearchableChipSelect({
  id,
  label,
  placeholder,
  options,
  selectedValues,
  maximum,
  onChange,
  helperText,
  allowCustom = false,
  required = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly SearchableChipOption[];
  selectedValues: string[];
  maximum: number;
  onChange: (values: string[]) => void;
  helperText?: string;
  allowCustom?: boolean;
  required?: boolean;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const labels = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );
  const filteredOptions = useMemo(
    () =>
      options
        .filter((option) => !selectedSet.has(option.value))
        .filter((option) => {
          if (!normalizedQuery) return true;
          const searchText = [
            option.label,
            option.value,
            ...(option.keywords ?? []),
          ]
            .join(" ")
            .toLocaleLowerCase();
          return searchText.includes(normalizedQuery);
        })
        .slice(0, 50),
    [normalizedQuery, options, selectedSet],
  );
  const customValue =
    allowCustom &&
    normalizedQuery &&
    !selectedValues.some(
      (value) => value.toLocaleLowerCase() === normalizedQuery,
    ) &&
    !options.some(
      (option) =>
        option.value.toLocaleLowerCase() === normalizedQuery ||
        option.label.toLocaleLowerCase() === normalizedQuery,
    )
      ? query.trim()
      : null;

  useEffect(() => {
    function closeWhenOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !fieldRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, []);

  function select(value: string) {
    if (selectedSet.has(value) || selectedValues.length >= maximum) return;
    onChange([...selectedValues, value]);
    setQuery("");
    setOpen(false);
  }

  function remove(value: string) {
    onChange(selectedValues.filter((item) => item !== value));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (customValue) {
      select(customValue);
      return;
    }
    if (filteredOptions[0]) select(filteredOptions[0].value);
  }

  const disabled = selectedValues.length >= maximum;

  return (
    <div ref={fieldRef} className="searchable-chip-field">
      <label className="preference-label" htmlFor={id}>
        {label}
        {required ? <span>*</span> : null}
      </label>
      <div className="searchable-chip-control">
        <input
          id={id}
          className="searchable-chip-input"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={id + "-options"}
          aria-expanded={open}
          aria-required={required || undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={disabled ? "Selection limit reached" : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="searchable-chip-caret" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="m5 7 5 5 5-5" />
          </svg>
        </span>
      </div>
      {open && !disabled ? (
        <div
          id={id + "-options"}
          className="searchable-chip-options"
          role="listbox"
          aria-label={label + " suggestions"}
        >
          {customValue ? (
            <button
              type="button"
              role="option"
              className="searchable-chip-option searchable-chip-option--custom"
              onClick={() => select(customValue)}
            >
              Add &quot;{customValue}&quot;
            </button>
          ) : null}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className="searchable-chip-option"
              onClick={() => select(option.value)}
            >
              {option.label}
            </button>
          ))}
          {!customValue && !filteredOptions.length ? (
            <p className="searchable-chip-empty">No matches found.</p>
          ) : null}
        </div>
      ) : null}
      {selectedValues.length ? (
        <ul className="preference-tag-list searchable-chip-list">
          {selectedValues.map((value) => (
            <li key={value}>
              <span>{labels.get(value) ?? value}</span>
              <button
                type="button"
                aria-label={"Remove " + (labels.get(value) ?? value)}
                onClick={() => remove(value)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <small className="searchable-chip-helper">
        {String(selectedValues.length) +
          "/" +
          String(maximum) +
          " selected" +
          (helperText ? " \u00b7 " + helperText : "")}
      </small>
    </div>
  );
}
