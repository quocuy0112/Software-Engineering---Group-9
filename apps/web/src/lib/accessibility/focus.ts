export function focusErrorSummary(root: ParentNode = document) {
  const summary=root.querySelector<HTMLElement>("[data-error-summary]"); summary?.focus(); return Boolean(summary);
}
export function focusHeading(root: ParentNode = document) {
  const heading=root.querySelector<HTMLElement>("h1"); heading?.setAttribute("tabindex","-1"); heading?.focus(); return Boolean(heading);
}
