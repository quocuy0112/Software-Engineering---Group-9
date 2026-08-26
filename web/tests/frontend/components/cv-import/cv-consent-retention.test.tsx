import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CvImportStatus } from "@/frontend/features/cv-import/components/cv-import-status";
import { CvProcessingConsent } from "@/frontend/features/cv-import/components/cv-processing-consent";
import { CvRetentionActions } from "@/frontend/features/cv-import/components/cv-retention-actions";
import {
  CV_EXTERNAL_CONSENT_NOTICE_TEXT,
  type CvConsentNotice,
} from "@/shared/contracts/cv-import/consent-retention";
import {
  cvImportResourceSchema,
  cvImportTombstoneSchema,
  type CvImportResource,
} from "@/shared/contracts/cv-import/upload";

const navigation = vi.hoisted(() => ({
  prefetch: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const challenge =
  "eyJ1IjoidXBsb2FkX2NvbnNlbnRfMTIzNCIsImUiOjE3ODU2MzAwMDB9.signature_fixture_12345678901234567890";
const refreshedChallenge =
  "eyJ1IjoidXBsb2FkX2NvbnNlbnRfMTIzNCIsImUiOjE3ODU2MzA2MDB9.refreshed_signature_fixture_1234567890";

function notice(
  granted = false,
  consentChallenge = challenge,
): CvConsentNotice {
  return {
    required: true,
    granted,
    providerDisplayName: "OpenAI",
    processingPurpose:
      "Create a private CV review draft by extracting professional facts",
    noticeText: CV_EXTERNAL_CONSENT_NOTICE_TEXT,
    consentChallenge,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  navigation.prefetch.mockClear();
  navigation.replace.mockClear();
});
afterEach(() => vi.useRealTimers());

function externalResource(
  changes: Partial<CvImportResource> = {},
): CvImportResource {
  return cvImportResourceSchema.parse({
    uploadId: "upload_consent_status_1234",
    displayFilename: "transient-private-name.pdf",
    documentKind: "PDF",
    parserClass: "EXTERNAL_OPENAI",
    status: "AWAITING_CONSENT",
    stage: "CONSENT",
    availableActions: ["GRANT_CONSENT", "DELETE", "MANUAL_PROFILE"],
    scanRetriesRemaining: 2,
    parseRetriesRemaining: 2,
    createdAt: "2026-08-02T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    draft: null,
    processingNotice: {
      noticeVersion: "cv-processing.v1",
      noticeText: "Synthetic general processing notice.",
      externalConsentRequiredFor: ["EXTERNAL_OPENAI"],
    },
    consent: notice(),
    failure: null,
    receipt: null,
    contentInaccessibleAt: null,
    deleteAfter: null,
    deletedAt: null,
    ...changes,
  });
}

describe("CV external consent and retention controls", () => {
  it("keeps the exact versioned grant unselected and browser fields server-bound", async () => {
    const onGrant = vi.fn(async () => undefined);
    render(
      <CvProcessingConsent
        notice={notice()}
        canGrant
        canRevoke={false}
        onGrant={onGrant}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText("Provider").nextElementSibling).toHaveTextContent(
      "OpenAI",
    );
    expect(screen.getByText("Purpose").nextElementSibling).toHaveTextContent(
      /create a private cv review draft/i,
    );
    fireEvent.click(screen.getByText(/technical and version details/i));
    expect(screen.getByText(/cv-external-consent\.v1/i)).toBeVisible();
    expect(screen.getByText(/cv-processing\.v1/i)).toBeVisible();
    const acceptance = screen.getByRole("checkbox", {
      name: CV_EXTERNAL_CONSENT_NOTICE_TEXT,
    });
    const grant = screen.getByRole("button", {
      name: /grant external processing consent/i,
    });
    expect(acceptance).not.toBeChecked();
    expect(grant).toBeDisabled();
    fireEvent.click(acceptance);
    fireEvent.click(grant);
    await waitFor(() => expect(onGrant).toHaveBeenCalledOnce());
    expect(onGrant).toHaveBeenCalledWith({
      accepted: true,
      consentChallenge: challenge,
    });
    expect(screen.getByRole("status")).toHaveTextContent(/consent granted/i);
    expect(screen.getByTestId("cv-processing-consent")).not.toHaveTextContent(
      /model selector|provider selector|endpoint/i,
    );
  });

  it("keeps acceptance checked across status polls and submits the newest challenge", async () => {
    const onGrant = vi.fn(async () => undefined);
    const view = render(
      <CvProcessingConsent
        notice={notice()}
        canGrant
        canRevoke={false}
        onGrant={onGrant}
        onRevoke={vi.fn()}
      />,
    );
    const acceptance = screen.getByRole("checkbox", {
      name: CV_EXTERNAL_CONSENT_NOTICE_TEXT,
    });
    fireEvent.click(acceptance);

    view.rerender(
      <CvProcessingConsent
        notice={notice(false, refreshedChallenge)}
        canGrant
        canRevoke={false}
        onGrant={onGrant}
        onRevoke={vi.fn()}
      />,
    );

    expect(acceptance).toBeChecked();
    const grant = screen.getByRole("button", {
      name: /grant external processing consent/i,
    });
    expect(grant).toBeEnabled();
    fireEvent.click(grant);
    await waitFor(() =>
      expect(onGrant).toHaveBeenCalledWith({
        accepted: true,
        consentChallenge: refreshedChallenge,
      }),
    );
  });

  it("revokes only future transmissions and preserves the past-processing caveat", async () => {
    const onRevoke = vi.fn(async () => undefined);
    render(
      <CvProcessingConsent
        notice={notice(true)}
        canGrant={false}
        canRevoke
        onGrant={vi.fn()}
        onRevoke={onRevoke}
      />,
    );
    expect(
      screen.getAllByText(/cannot recall processing already transmitted/i),
    ).not.toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", {
        name: /revoke consent for future processing/i,
      }),
    );
    await waitFor(() => expect(onRevoke).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      /future external processing is blocked/i,
    );
  });

  it("disables repeated revoke attempts after the session expires", async () => {
    const onRevoke = vi.fn(async () => {
      throw new Error("CV_SESSION_EXPIRED");
    });
    render(
      <CvProcessingConsent
        notice={notice(true)}
        canGrant={false}
        canRevoke
        onGrant={vi.fn()}
        onRevoke={onRevoke}
      />,
    );
    const revoke = screen.getByRole("button", {
      name: /revoke consent for future processing/i,
    });
    fireEvent.click(revoke);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /session expired/i,
    );
    expect(revoke).toBeDisabled();
    fireEvent.click(revoke);
    expect(onRevoke).toHaveBeenCalledOnce();
  });

  it("shows deadlines and requires a destructive confirmation before immediate cancellation", async () => {
    const onDelete = vi.fn(async () => ({
      uploadId: "upload_retention_ui_1234",
      status: "CANCELLED" as const,
      contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
      deleteAfter: "2026-08-03T00:00:00.000Z",
      deletedAt: null,
      statusUrl: "/api/account/cv-imports/upload_retention_ui_1234",
    }));
    render(
      <CvRetentionActions
        resource={{
          uploadId: "upload_retention_ui_1234",
          status: "PARSING",
          expiresAt: "2026-09-01T00:00:00.000Z",
          contentInaccessibleAt: null,
          deleteAfter: null,
          deletedAt: null,
        }}
        canDelete
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/Sep 1, 2026/)).toBeVisible();
    const trigger = screen.getByRole("button", {
      name: /cancel and delete this cv import/i,
    });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: /permanently delete temporary cv data/i,
    });
    expect(dialog).toHaveTextContent(/access ends immediately/i);
    expect(dialog).toHaveTextContent(/within 24 hours/i);
    expect(dialog).toHaveTextContent(/candidate profile remains available/i);
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel and delete/i }),
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      /deletion accepted[\s\S]*cleanup[\s\S]*Aug 3, 2026/i,
    );
  });

  it.each([
    ["CANCELLED", null, /cleanup is pending/i],
    [
      "DELETED",
      "2026-08-02T12:00:00.000Z",
      /temporary import content has been removed/i,
    ],
  ] as const)(
    "keeps the %s outcome persistent with manual Profile access",
    (status, deletedAt, message) => {
      render(
        <CvRetentionActions
          resource={{
            uploadId: "upload_retention_outcome_1234",
            status,
            expiresAt: null,
            contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
            deleteAfter: "2026-08-03T00:00:00.000Z",
            deletedAt,
          }}
          canDelete={false}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(message);
      expect(
        screen.getByRole("link", { name: /open candidate profile/i }),
      ).toHaveAttribute("href", "/profile");
    },
  );

  it("binds the real status grant request to the challenge and refreshes server state", async () => {
    const next = externalResource({
      status: "PARSE_QUEUED",
      stage: "PARSE",
      availableActions: ["REVOKE_CONSENT", "DELETE"],
      consent: notice(true),
    });
    const loadStatus = vi.fn(async () => next);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          uploadId: "upload_consent_status_1234",
          grantedAt: "2026-08-02T00:00:01.000Z",
          status: "PARSE_QUEUED",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <CvImportStatus
        resource={{ ...externalResource(), pollingAfterMs: null }}
        loadStatus={loadStatus}
        csrfProof="csrf_consent_status"
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: CV_EXTERNAL_CONSENT_NOTICE_TEXT }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /grant external processing consent/i,
      }),
    );
    await waitFor(() => expect(loadStatus).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/cv-imports/upload_consent_status_1234/consent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ accepted: true, consentChallenge: challenge }),
      }),
    );
    expect(
      screen.getByRole("button", {
        name: /revoke consent for future processing/i,
      }),
    ).toBeVisible();
  });

  it("uses the focused recovery workspace for a consent-required failure", async () => {
    const next = externalResource({
      status: "PARSE_QUEUED",
      stage: "PARSE",
      availableActions: ["REVOKE_CONSENT", "DELETE"],
      consent: notice(true),
    });
    const loadStatus = vi.fn(async () => next);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          uploadId: "upload_consent_status_1234",
          grantedAt: "2026-08-02T00:00:01.000Z",
          status: "PARSE_QUEUED",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <CvImportStatus
        resource={externalResource({
          status: "PARSE_FAILED",
          stage: "PARSE",
          failure: {
            code: "CONSENT_REQUIRED",
            message: "Candidate consent is required before parsing.",
            retryable: false,
            suggestedActions: ["MANUAL_PROFILE", "DELETE"],
          },
        })}
        loadStatus={loadStatus}
        csrfProof="csrf_consent_required"
      />,
    );

    expect(
      screen.getByTestId("cv-consent-required-recovery"),
    ).toBeVisible();
    expect(
      screen.queryByTestId("cv-processing-consent"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /choose file/i }),
    ).toHaveAttribute("href", "/profile/cv-imports");
    expect(
      screen.getByRole("link", { name: /manual entry/i }),
    ).toHaveAttribute("href", "/profile");

    fireEvent.click(
      screen.getByRole("button", { name: /grant and resume/i }),
    );
    await waitFor(() => expect(loadStatus).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/cv-imports/upload_consent_status_1234/consent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ accepted: true, consentChallenge: challenge }),
      }),
    );
  });

  it("replaces active status memory with the safe 202 tombstone immediately", async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          uploadId: "upload_consent_status_1234",
          status: "CANCELLED",
          contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
          deleteAfter: "2026-08-03T00:00:00.000Z",
          deletedAt: null,
          statusUrl: "/api/account/cv-imports/upload_consent_status_1234",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      ),
    );
    render(
      <CvImportStatus
        resource={{ ...externalResource(), pollingAfterMs: null }}
        csrfProof="csrf_delete_status"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /cancel and delete this cv import/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel and delete/i }),
    );
    await waitFor(() => expect(screen.getByText(/cancelled/i)).toBeVisible());
    expect(
      screen.queryByTestId("cv-processing-consent"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Processing timeline"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/cleanup is pending/i);
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });

  it("polls a CANCELLED tombstone until cleanup reports DELETED", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T00:00:00.000Z"));
    const deleted = cvImportTombstoneSchema.parse({
      uploadId: "upload_consent_status_1234",
      status: "DELETED",
      contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
      deleteAfter: "2026-08-03T00:00:00.000Z",
      deletedAt: "2026-08-02T00:00:02.000Z",
    });
    const loadStatus = vi.fn(async () => ({
      ...deleted,
      pollingAfterMs: null,
    }));
    render(
      <CvImportStatus
        resource={{
          uploadId: "upload_consent_status_1234",
          status: "CANCELLED",
          contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
          deleteAfter: "2026-08-03T00:00:00.000Z",
          deletedAt: null,
          pollingAfterMs: 2_000,
        }}
        loadStatus={loadStatus}
        csrfProof="csrf_poll_status"
      />,
    );
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(loadStatus).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(
      /temporary import content has been removed/i,
    );
  });
});
