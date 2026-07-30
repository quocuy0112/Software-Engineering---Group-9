import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TotpEnrollment } from "@/frontend/features/authentication/components/auth/totp-enrollment";

// A 1x1 PNG data URL stands in for the server-rendered QR image.
const QR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const BACKUP_CODES = Array.from(
  { length: 10 },
  (_, index) => `code${index}-abcde`,
);

function mockFetch() {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/identity/sessions")) {
        return Response.json({ csrfProof: "proof-token" });
      }
      if (url.endsWith("/api/identity/two-factor/enrollment")) {
        return Response.json({
          qrCodeDataUrl: QR_DATA_URL,
          manualKey: "JBSWY3DPEHPK3PXP",
          issuer: "SmartHire",
          accountLabel: "demo@example.test",
        });
      }
      if (url.endsWith("/api/identity/two-factor/enrollment/verify")) {
        return Response.json({ backupCodes: BACKUP_CODES });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? "GET"}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("TOTP enrollment UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("labels the password field for keyboard and screen-reader use", async () => {
    mockFetch();
    render(<TotpEnrollment />);
    const password = screen.getByLabelText("Current password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  it("shows inline validation before submitting", async () => {
    const fetchMock = mockFetch();
    render(<TotpEnrollment />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/identity/sessions",
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText("Enter your current password."),
    ).toBeVisible();
  });

  it("reports an enrollment service failure without blaming the password", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/identity/sessions")) {
        return Response.json({ csrfProof: "proof-token" });
      }
      if (url.endsWith("/api/identity/two-factor/enrollment")) {
        return Response.json(
          {
            message:
              "Two-factor setup is temporarily unavailable. Please try again.",
          },
          { status: 502 },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TotpEnrollment />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Two-factor setup is temporarily unavailable",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "confirm your current password",
    );
  });

  it("renders the server QR image, manual key, verifies, and reveals exactly ten backup codes once", async () => {
    const fetchMock = mockFetch();
    render(<TotpEnrollment />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/identity/sessions",
        expect.anything(),
      ),
    );

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const image = (await screen.findByRole("img", {
      name: /QR code/i,
    })) as HTMLImageElement;
    expect(image.src).toBe(QR_DATA_URL);
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
    expect(screen.getByText(/SmartHire/)).toBeVisible();
    expect(screen.getByText(/demo@example.test/)).toBeVisible();

    const code = screen.getByLabelText("Six-digit code");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enable" }));

    const heading = await screen.findByRole("heading", {
      name: "Save your backup codes",
    });
    expect(heading).toBeVisible();
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    expect(screen.getByRole("alert")).toHaveTextContent(/only once/i);

    // The verify request must carry the CSRF proof and never appear in the URL.
    const verifyCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/identity/two-factor/enrollment/verify"),
    );
    expect(verifyCall?.[1]?.headers).toMatchObject({
      "x-csrf-token": "proof-token",
    });
    expect(String(verifyCall?.[0])).not.toContain("123456");
  });

  it("shows the remaining TOTP verification attempts before the limit is reached", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/identity/sessions")) {
        return Response.json({ csrfProof: "proof-token" });
      }
      if (url.endsWith("/api/identity/two-factor/enrollment")) {
        return Response.json({
          qrCodeDataUrl: QR_DATA_URL,
          manualKey: "JBSWY3DPEHPK3PXP",
          issuer: "SmartHire",
          accountLabel: "demo@example.test",
        });
      }
      if (url.endsWith("/api/identity/two-factor/enrollment/verify")) {
        return Response.json(
          { message: "That code could not be verified. Try again." },
          { status: 401 },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TotpEnrollment />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("img", { name: /QR code/i });

    fireEvent.change(screen.getByLabelText("Six-digit code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enable" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("4 attempts remaining"),
    );
  });

  it("prevents duplicate submission while the request is in flight", async () => {
    let release!: (value: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/identity/sessions"))
        return Promise.resolve(Response.json({ csrfProof: "proof-token" }));
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TotpEnrollment />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: /Starting|Continue/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Starting/ })).toBeDisabled(),
    );
    const enrollmentCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/identity/two-factor/enrollment"),
    );
    expect(enrollmentCalls).toHaveLength(1);
    release(
      Response.json({
        qrCodeDataUrl: QR_DATA_URL,
        manualKey: "K",
        issuer: "SmartHire",
        accountLabel: "demo@example.test",
      }),
    );
  });

  it("clears the QR/backup state when enrollment is cancelled", async () => {
    mockFetch();
    render(<TotpEnrollment />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("img", { name: /QR code/i });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("img", { name: /QR code/i })).toBeNull();
    expect(screen.getByLabelText("Current password")).toBeVisible();
  });
});
