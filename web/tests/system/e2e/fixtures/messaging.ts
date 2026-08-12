export const messagingE2eUsers = {
  candidate: {
    email: process.env.MESSAGING_E2E_CANDIDATE_EMAIL ?? "candidate@example.test",
    password: process.env.MESSAGING_E2E_CANDIDATE_PASSWORD ?? "test-only-password",
  },
  recruiter: {
    email: process.env.MESSAGING_E2E_RECRUITER_EMAIL ?? "recruiter@example.test",
    password: process.env.MESSAGING_E2E_RECRUITER_PASSWORD ?? "test-only-password",
  },
} as const;

export const messagingE2eContexts = {
  applicationId: process.env.MESSAGING_E2E_APPLICATION_ID ?? "fixture-application",
  connectionId: process.env.MESSAGING_E2E_CONNECTION_ID ?? "fixture-connection",
  outsiderUserId: process.env.MESSAGING_E2E_OUTSIDER_ID ?? "fixture-outsider",
} as const;
