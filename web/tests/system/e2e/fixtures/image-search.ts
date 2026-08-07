import { resolve } from "node:path";
import type { Page } from "@playwright/test";

const queryId = "image-query-00000001";
const capability = "c".repeat(43);
const admittedAt = "2026-08-06T00:00:00.000Z";
const expiresAt = "2026-08-06T00:15:00.000Z";

export type MockImageSearchMode =
  | "INTENT"
  | "FALLBACK"
  | "OCR_FAILED"
  | "HOLD"
  | "RATE_LIMITED";

export async function installMockImageSearchApi(
  page: Page,
  mode: MockImageSearchMode,
) {
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  await page.route("**/api/identity/sessions", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfProof: "e2e-csrf" }),
    }),
  );
  await page.route("**/api/jobs/image-searches**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    requests.push({ method: request.method(), path: url.pathname, body });
    const json = (status: number, value: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "cache-control": "no-store, max-age=0" },
        body: JSON.stringify(value),
      });
    if (
      url.pathname === "/api/jobs/image-searches" &&
      request.method() === "POST"
    ) {
      if (mode === "RATE_LIMITED")
        return json(429, {
          error: {
            code: "IMAGE_QUERY_RATE_LIMITED",
            message: "Try again after the displayed time.",
            requestId: "e2e-request",
            retryAt: "2026-08-06T01:00:00.000Z",
            fieldErrors: [],
          },
        });
      return json(201, {
        queryId,
        actorClass: "VISITOR",
        capability,
        status: "AWAITING_CONTENT",
        admittedAt,
        expiresAt,
        upload: {
          method: "PUT",
          path: `/api/jobs/image-searches/${queryId}/content`,
          mediaType: "image/jpeg",
          bytes: (body as { bytes: number }).bytes,
        },
      });
    }
    if (url.pathname.endsWith("/content") && request.method() === "PUT")
      return route.fulfill({
        status: 204,
        headers: { "cache-control": "no-store" },
      });
    if (url.pathname.endsWith("/consent") && request.method() === "POST")
      return json(200, {
        action: "REVOKED",
        occurredAt: admittedAt,
        state: "FALLBACK_READY",
      });
    if (url.pathname.endsWith("/result") && request.method() === "POST") {
      if (mode === "FALLBACK")
        return json(200, {
          kind: "OCR_TEXT_FALLBACK",
          queryId,
          text: "TypeScript remote engineer",
          language: "EN",
          warnings: ["INTERPRETER_UNAVAILABLE"],
        });
      return json(200, {
        kind: "VALIDATED_INTENT",
        queryId,
        intent: {
          schemaVersion: "job-search-intent-v1",
          language: "EN",
          warnings: [],
          proposals: [
            {
              id: "remote-e2e",
              field: "workArrangement",
              stringValue: null,
              numberValue: null,
              stringValues: ["REMOTE"],
              confidence: 0.98,
              basis: "NORMALIZED",
              evidence: [
                { startCodePoint: 0, endCodePoint: 6, text: "Remote" },
              ],
              selected: true,
              selectionReason: "AUTO_NORMALIZED",
            },
          ],
        },
      });
    }
    if (request.method() === "DELETE") return route.fulfill({ status: 204 });
    if (request.method() === "GET") {
      const state =
        mode === "OCR_FAILED"
          ? "OCR_FAILED"
          : mode === "HOLD"
            ? "OCR_PROCESSING"
            : mode === "FALLBACK"
              ? "FALLBACK_READY"
              : "RESULT_READY";
      return json(200, {
        queryId,
        state,
        stage:
          state === "OCR_FAILED"
            ? "TERMINAL"
            : state === "OCR_PROCESSING"
              ? "OCR"
              : "RESULT",
        availableActions:
          state === "OCR_PROCESSING"
            ? ["CANCEL"]
            : state === "OCR_FAILED"
              ? []
              : ["CONSUME_RESULT"],
        admittedAt,
        expiresAt,
        retryAt: null,
        failureCode: state === "OCR_FAILED" ? "OCR_UNAVAILABLE" : null,
      });
    }
    return route.abort();
  });
  return { requests, queryId, capability };
}

export function posterFixture() {
  return resolve(process.cwd(), "tests/fixtures/ocr-corpus/images/ocr-061.jpg");
}

export async function openImageSearch(
  page: Page,
  path = "/jobs",
  grantConsent = true,
) {
  await page.goto(path);
  await page
    .getByRole("button", {
      name: "Search jobs from an image",
    })
    .click();
  if (grantConsent) {
    await page
      .getByRole("checkbox", {
        name: /I agree that SmartHire may send only the recognized text/u,
      })
      .check();
  }
  return page.getByLabel("Job poster image");
}
