"use client";

import { useEffect, useRef, useState } from "react";

export function HomeMobileNavigation({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLElement>("a, button, select")?.focus();
  }, [open]);
  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>("a, button, select")];
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <div className="home-mobile-nav">
      <button
        ref={button}
        type="button"
        className="home-menu-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="home-mobile-links"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div
        ref={panel}
        id="home-mobile-links"
        hidden={!open}
        className="home-mobile-panel"
        onClick={() => setOpen(false)}
        onKeyDown={trapFocus}
      >
        {children}
      </div>
    </div>
  );
}
