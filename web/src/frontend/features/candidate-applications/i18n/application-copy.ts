export type ApplicationLocale = "en" | "vi";

const englishApplicationCopy = {
  applicationsList: {
    eyebrow: "Candidate workspace",
    title: "Applications",
    subtitle: "Track every application in one place.",
    filterLabel: "Filter",
    filters: {
      all: "All applications",
      applicationSubmitted: "Submitted",
      underReview: "Under review",
      interview: "Interview",
      outcome: "Outcome",
      terminal: "Terminal",
      withdrawn: "Withdrawn",
    },
    statuses: {
      APPLIED: "Application submitted",
      VIEWED: "Viewed",
      SHORTLISTED: "Shortlisted",
      INTERVIEWING: "Interview",
      OFFERED: "Offer sent",
      HIRED: "Hired",
      OFFER_DECLINED: "Offer declined",
      REJECTED: "Rejected",
      WAITLISTED: "Waitlisted",
      WITHDRAWN: "Withdrawn",
    },
    submitted: (date: string) => `Submitted ${date}`,
    updated: (date: string) => `Updated ${date}`,
    viewStatus: "View application status",
    loadMore: "Load more applications",
    loading: "Loading…",
    loadMoreError: "More applications could not be loaded.",
    noMatchesTitle: "No applications match this filter",
    noMatchesDescription: "Try another status to see your applications.",
    emptyTitle: "No applications yet",
    emptyDescription: "Applications you submit will appear here.",
    browseJobs: "Browse jobs",
  },
  common: {
    jobs: "Jobs",
    apply: "Apply",
    breadcrumb: "Breadcrumb",
    saveDraft: "Save draft",
    saving: "Saving…",
    applicationSteps: "Application steps",
  },
  stepper: {
    step: (number: number) => `Step ${number}`,
    personalInformation: "Personal information",
    applicationFiles: "Application files",
    reviewAndSubmit: "Review and submit",
    dueDate: (date: string) => `Due ${date}`,
  },
  personalInformation: {
    eyebrow: "Step 1 of 3",
    title: (jobTitle: string) => `Apply – ${jobTitle}`,
    subtitle:
      "Confirm your personal information before continuing to your application files.",
    cardTitle: "Personal information",
    cardDescription:
      "Taken from your candidate profile. To send this application, confirm the details below.",
    fullName: "Full name",
    email: "Email",
    phone: "Phone number",
    currentLocation: "Current location",
    linkedInPortfolio: "LinkedIn / Portfolio",
    optional: "Optional",
    lockedEmailNote: "Locked because it's your verified sign-in email.",
    contactSupport: "Contact support to change it.",
    phonePlaceholder: "Enter your phone number",
    locationPlaceholder: "Enter your current location",
    linkedInPlaceholder: "https://",
    phoneHint: "Editable for this application only.",
    linkedInHint: "Shown to the recruiter alongside your CV, if provided.",
    trustTitle: "This information is shared with the recruiter only.",
    trustDescription:
      "Gender, age, marital status and other sensitive attributes are never requested here and are excluded from automated assessment.",
    jobSummary: "Job summary",
    applicationProgress: "Application progress",
    whyWeAsk: "Why we ask this",
    whyWeAskFirst:
      "The recruiter needs a way to reach you and to confirm your CV belongs to the right person.",
    whyWeAskSecond: "You can edit your phone number and location anytime from",
    profileAndCv: "Profile & CV",
    whyWeAskThird: "Changes here apply to this application only.",
    backToJob: "Back to job",
    continueToFiles: "Continue to Application files",
    phoneRequired: "Enter a phone number to continue.",
    phoneInvalid: "Enter a valid phone number.",
    locationRequired: "Enter your current location to continue.",
    urlInvalid: "Enter a valid LinkedIn or portfolio URL.",
    draftSaveError: "The draft could not be saved.",
  },
  applicationFiles: {
    eyebrow: "Step 2 of 3",
    title: (jobTitle: string) => `Apply – ${jobTitle}`,
    subtitle: "Add the files the recruiter will see with your application.",
    cvTitle: "CV / Resume",
    required: "Required",
    optional: "Optional",
    cvDescription: "This is the CV the recruiter and Smart Match will read.",
    fromProfile: "From my profile",
    uploadFromDevice: "Upload from device",
    manageCvs: "Manage CVs in Profile & CV",
    noProfileCvs: "No confirmed CVs are available in your Profile & CV yet.",
    profileCvMeta: (size: string, updated: string) =>
      `${size} · Updated ${updated}`,
    cvReady: "Ready for this application",
    uploadDropTitle: "Drag and drop your CV, or browse",
    uploadDropHint: "PDF, DOC or DOCX — up to 5MB",
    uploadingCv: "Uploading your CV…",
    uploadedCvMeta: (size: string) => `${size} · Ready for this application`,
    cvParsingNoteTitle: "Make sure your CV is text-based, not a scanned image.",
    cvParsingNote:
      "Scanned or image-only PDFs can't be parsed automatically — Smart Match may not read your skills correctly.",
    coverLetterTitle: "Cover letter",
    coverLetterDescription:
      "Attach a cover letter file, or write a short message directly.",
    attachFile: "Attach file",
    writeText: "Write text",
    coverLetterDropTitle: "Drag and drop your cover letter, or browse",
    coverLetterDropHint: "PDF, DOC or DOCX — up to 5MB",
    coverLetterPlaceholder:
      "Tell the recruiter why you're a good fit for this role…",
    characters: (current: number, maximum: number) => `${current} / ${maximum}`,
    noCoverLetterFile: "No cover letter file selected.",
    noParsingRequired: "No parsing required",
    change: "Change",
    remove: "Remove",
    applicationProgress: "Application progress",
    jobSummary: "Job summary",
    fileRequirements: "File requirements",
    fileRequirementFormat: "PDF, DOC or DOCX for your CV and cover letter",
    fileRequirementSize: "Up to 5MB per file",
    fileRequirementText: "Text-based PDFs parse best — avoid scanned images",
    fileRequirementReplace:
      "You can switch source or replace any file before submitting",
    backToPersonalInformation: "Back to Personal information",
    continueToReview: "Continue to Review and submit",
    cvRequired: "Choose a CV before continuing.",
    cvFileSizeError: "CV files must be between 1 byte and 5 MB.",
    cvFileTypeError: "Choose a PDF, DOC, or DOCX file.",
    cvUploadError: "The CV could not be uploaded.",
    coverFileSizeError: "Cover letters must be between 1 byte and 5 MB.",
    coverFileTypeError: "Choose a PDF, DOC, or DOCX cover letter.",
    coverUploadError: "The cover letter could not be uploaded.",
    coverLetterNeedsReupload:
      "This cover letter is no longer available. Upload it again before continuing.",
    draftSaveError: "The draft could not be saved.",
    backToJob: "Back to job",
  },
  reviewAndSubmit: {
    eyebrow: "Step 3 of 3",
    title: (jobTitle: string) => `Apply – ${jobTitle}`,
    subtitle:
      "Review your information and files before sending them to the recruiter.",
    personalInformation: "Personal information",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    currentLocation: "Current location",
    linkedInPortfolio: "LinkedIn / Portfolio",
    notProvided: "Not provided",
    edit: "Edit",
    applicationFiles: "Application files",
    cvResume: "CV / Resume",
    coverLetter: "Cover letter",
    fromProfile: "From profile",
    uploaded: "Uploaded",
    attachedFile: "Attached file",
    noCoverLetter: "No cover letter added",
    pageCount: (count: number | null | undefined) =>
      count
        ? `${count} ${count === 1 ? "page" : "pages"}`
        : "Page count unavailable",
    fileType: (mimeType: string) => {
      if (mimeType === "application/pdf") return "PDF";
      if (mimeType.includes("word")) return "Document";
      return "File";
    },
    fileSize: (bytes: number) =>
      `${(bytes / 1_000_000).toFixed(bytes < 1_000_000 ? 1 : 0)} MB`,
    parseStatus: {
      READY: "Read successfully",
      PARTIAL: "Partially parsed",
      FAILED: "Needs attention",
      NOT_APPLICABLE: "Available",
    },
    messageToRecruiter: "Message to the recruiter",
    messagePlaceholder: "Add a short note for the recruiter (optional)…",
    transparencyTitle: "Transparency about automated support",
    transparencyDescription:
      "Recruiters may use automated tools to compare an application with job requirements. Scores, rankings, and internal notes are not shown to candidates and do not make the final hiring decision.",
    transparencySensitiveAttributes:
      "Gender, age, marital status, and other sensitive personal attributes are excluded from automated assessment.",
    confirmation:
      "I confirm that the information is correct and agree to send this application to the recruiter.",
    filesToBeSubmitted: "Files to be submitted",
    jobSummary: "Job summary",
    checklistPersonalInformation: "Personal information",
    checklistCv: (fileName: string) => `CV ${fileName}`,
    checklistCoverLetter: "Cover letter",
    checklistMessage: "Message to the recruiter",
    afterSubmission: "After submission",
    afterSubmissionDescription:
      "You will see the submission status and recruitment progress. AI scores, match scores, and rankings are not shown.",
    afterSubmissionWithdrawal:
      "You can withdraw your application before the recruiter moves it to the interview stage.",
    backToFiles: "Back to Application files",
    submit: "Submit application",
    submitting: "Submitting…",
    confirmationRequired: "Confirm the application details before submitting.",
    cvRequired: "Select a CV before submitting.",
    draftSaveError: "The draft could not be saved.",
    submitError: "The application could not be submitted.",
  },
} as const;

// TODO(i18n): Translate the Apply flow and application-list copy for VI.
// English is the temporary fallback until the approved Vietnamese source
// strings are available.
const vietnameseApplicationCopy = englishApplicationCopy;

export type ApplicationCopy = typeof englishApplicationCopy;

export function applicationCopy(locale: ApplicationLocale): ApplicationCopy {
  return locale === "vi" ? vietnameseApplicationCopy : englishApplicationCopy;
}
