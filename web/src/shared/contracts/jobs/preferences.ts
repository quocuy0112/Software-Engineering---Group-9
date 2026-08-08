import { z } from "zod";

export const jobGenderSchema = z.enum(["female", "male", "undisclosed"]);

export const jobExperiencePreferenceSchema = z.enum([
  "no_experience",
  "under_1_year",
  "1_3_years",
  "3_5_years",
  "5_plus_years",
]);

export const jobPreferencesSchema = z
  .object({
    gender: jobGenderSchema,
    professionalPositions: z.array(z.string().trim().min(1).max(128)).max(5),
    customPositions: z.array(z.string().trim().min(1).max(160)).max(5),
    skills: z.array(z.string().trim().min(1).max(80)).max(20),
    experienceLevel: jobExperiencePreferenceSchema,
    desiredSalaryMin: z.number().int().nonnegative(),
    workLocations: z.array(z.string().trim().min(1).max(100)).max(63),
    openToRelocation: z.boolean(),
    aiAnalysisConsent: z.boolean(),
    jobUpdateNotificationConsent: z.boolean(),
  })
  .strict();

export const jobPreferencesUpdateSchema = jobPreferencesSchema.refine(
  (preferences) => preferences.aiAnalysisConsent,
  {
    path: ["aiAnalysisConsent"],
    message: "AI analysis consent is required for job recommendations.",
  },
);

export type JobGender = z.infer<typeof jobGenderSchema>;
export type JobExperiencePreference = z.infer<
  typeof jobExperiencePreferenceSchema
>;
export type JobPreferences = z.infer<typeof jobPreferencesSchema>;

export const defaultJobPreferences: JobPreferences = {
  gender: "undisclosed",
  professionalPositions: [],
  customPositions: [],
  skills: [],
  experienceLevel: "no_experience",
  desiredSalaryMin: 0,
  workLocations: [],
  openToRelocation: false,
  aiAnalysisConsent: false,
  jobUpdateNotificationConsent: false,
};

export const jobExperiencePreferenceOptions: ReadonlyArray<{
  value: JobExperiencePreference;
  label: string;
}> = [
  { value: "no_experience", label: "No experience" },
  { value: "under_1_year", label: "Under 1 year" },
  { value: "1_3_years", label: "1-3 years" },
  { value: "3_5_years", label: "3-5 years" },
  { value: "5_plus_years", label: "5+ years" },
];

/** The 63-province list used by the candidate-facing location selector. */
export const VIETNAM_PROVINCES_63 = [
  "An Giang",
  "B\u00e0 R\u1ecba - V\u0169ng T\u00e0u",
  "B\u1eafc Giang",
  "B\u1eafc K\u1ea1n",
  "B\u1ea1c Li\u00eau",
  "B\u1eafc Ninh",
  "B\u1ebfn Tre",
  "B\u00ecnh \u0110\u1ecbnh",
  "B\u00ecnh D\u01b0\u01a1ng",
  "B\u00ecnh Ph\u01b0\u1edbc",
  "B\u00ecnh Thu\u1eadn",
  "C\u00e0 Mau",
  "Cao B\u1eb1ng",
  "C\u1ea7n Th\u01a1",
  "\u0110\u00e0 N\u1eb5ng",
  "\u0110\u1eafk L\u1eafk",
  "\u0110\u1eafk N\u00f4ng",
  "\u0110i\u1ec7n Bi\u00ean",
  "\u0110\u1ed3ng Nai",
  "\u0110\u1ed3ng Th\u00e1p",
  "Gia Lai",
  "H\u00e0 Giang",
  "H\u00e0 Nam",
  "H\u00e0 N\u1ed9i",
  "H\u00e0 T\u0129nh",
  "H\u1ea3i D\u01b0\u01a1ng",
  "H\u1ea3i Ph\u00f2ng",
  "H\u1eadu Giang",
  "H\u00f2a B\u00ecnh",
  "H\u01b0ng Y\u00ean",
  "Kh\u00e1nh H\u00f2a",
  "Ki\u00ean Giang",
  "Kon Tum",
  "Lai Ch\u00e2u",
  "L\u00e2m \u0110\u1ed3ng",
  "L\u1ea1ng S\u01a1n",
  "L\u00e0o Cai",
  "Long An",
  "Nam \u0110\u1ecbnh",
  "Ngh\u1ec7 An",
  "Ninh B\u00ecnh",
  "Ninh Thu\u1eadn",
  "Ph\u00fa Th\u1ecd",
  "Ph\u00fa Y\u00ean",
  "Qu\u1ea3ng B\u00ecnh",
  "Qu\u1ea3ng Nam",
  "Qu\u1ea3ng Ng\u00e3i",
  "Qu\u1ea3ng Ninh",
  "Qu\u1ea3ng Tr\u1ecb",
  "S\u00f3c Tr\u0103ng",
  "S\u01a1n La",
  "T\u00e2y Ninh",
  "Th\u00e1i B\u00ecnh",
  "Th\u00e1i Nguy\u00ean",
  "Thanh H\u00f3a",
  "Th\u1eeba Thi\u00ean Hu\u1ebf",
  "Ti\u1ec1n Giang",
  "TP H\u1ed3 Ch\u00ed Minh",
  "Tr\u00e0 Vinh",
  "Tuy\u00ean Quang",
  "V\u0129nh Long",
  "V\u0129nh Ph\u00fac",
  "Y\u00ean B\u00e1i",
] as const;
