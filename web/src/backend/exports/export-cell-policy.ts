import "server-only";

export function normalizeExportCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[\s]*[=+@-]/u.test(text) ? "'" + text : text;
}

export function csvCell(value: unknown) {
  const text = normalizeExportCell(value);
  return /[",\r\n]/u.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
