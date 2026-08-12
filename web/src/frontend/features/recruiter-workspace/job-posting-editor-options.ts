export const experienceOptions = [
  { minYears: 0, label: "No experience required" },
  { minYears: 1, label: "1-3 years" },
  { minYears: 3, label: "3+ years" },
  { minYears: 4, label: "4+ years" },
  { minYears: 5, label: "5+ years" },
  { minYears: 6, label: "6+ years" },
  { minYears: 10, label: "10+ years" },
  { minYears: 12, label: "12+ years" },
] as const;

export const levelOptions = [
  ["intern", "Intern"],
  ["staff", "Staff"],
  ["senior", "Senior"],
  ["team_lead", "Team lead"],
  ["manager", "Manager"],
  ["executive", "Executive"],
  ["director", "Director"],
] as const;

export const employmentOptions = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["internship", "Internship"],
  ["contract", "Contract"],
  ["temporary", "Temporary"],
] as const;

export const educationOptions = [
  "Currently studying (Bachelor's program)",
  "College degree or above",
  "Bachelor's degree",
  "Bachelor's degree or above",
  "Master's degree or above preferred",
  "Bachelor's/Master's degree preferred",
] as const;

export const benefitOptions = [
  {
    icon: "award",
    glyph: "★",
    label: "Recognition programs and quarterly awards",
  },
  { icon: "gift", glyph: "◇", label: "Holiday and Tet bonus" },
  {
    icon: "coffee",
    glyph: "☕",
    label: "Free lunch, coffee and snacks at the office",
  },
  { icon: "car", glyph: "▱", label: "Parking allowance / shuttle bus support" },
  {
    icon: "trending-up",
    glyph: "↗",
    label: "Clear career development and promotion path",
  },
  { icon: "briefcase", glyph: "▣", label: "Laptop and equipment provided" },
  { icon: "calendar", glyph: "□", label: "16-18 days of paid annual leave" },
  {
    icon: "dollar-sign",
    glyph: "$",
    label: "13th month salary and performance bonus",
  },
  {
    icon: "globe",
    glyph: "◎",
    label: "Opportunity to work with international partners",
  },
  {
    icon: "users",
    glyph: "●",
    label: "Team building activities and company trips",
  },
  {
    icon: "book-open",
    glyph: "≡",
    label: "Training budget and certification sponsorship",
  },
  {
    icon: "activity",
    glyph: "⌁",
    label: "Sponsored gym membership and sport clubs",
  },
  {
    icon: "heart",
    glyph: "♥",
    label: "Premium healthcare package for employee and dependents",
  },
  {
    icon: "shield",
    glyph: "⬡",
    label: "Social, health & unemployment insurance as per Labor Law",
  },
  {
    icon: "smile",
    glyph: "◡",
    label: "Flexible working hours and hybrid option",
  },
] as const;

export const sectionNames = [
  "Basic info",
  "Location & work arrangement",
  "Candidate requirements",
  "Salary & benefits",
  "Job description",
  "Hiring settings",
] as const;

export function titleCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function textToList(value: string) {
  return value.split(/\r?\n/gu);
}

export function listToText(value: string[]) {
  return value.join("\n");
}
