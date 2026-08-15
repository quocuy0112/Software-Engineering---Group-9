export function pluralize(count: number, singular: string, plural: string) {
  return Math.abs(count) === 1 ? singular : plural;
}
