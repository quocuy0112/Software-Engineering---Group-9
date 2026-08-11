import { randomUUID } from "node:crypto";
import { test, expect } from "./admin-e2e-fixture";
import { adminE2eControl } from "./admin-e2e-process";
import { queryAdminE2eState } from "./e2e-prisma";
import { freshTotp } from "./admin-e2e-totp";

type AccountScenario = {
  runId: string;
  accountId: string;
  displayName: string;
};

type AccountSecurityState = {
  account: { state: string; sessions: Array<{ revokedAt: string | null }> };
  works: Array<{
    kind: string;
    status: string;
    idempotencyKey: string;
    opsAlertedAt: string | null;
    emailOutbox: null | {
      id: string;
      status: string;
      idempotencyKey: string;
    };
  }>;
  singleSessionAudits: number;
  allSessionAudits: number;
};

type DeliveryResult = {
  providerAttempts: number;
  transitions: Array<{
    status: string;
    attempts: number;
    safeErrorCode: string | null;
    at: string;
    nextAttemptAt: string;
    workStatus: string | null;
  }>;
  messages: Array<{ subject: string; text: string; html: string }>;
  alertCount: number;
  restartAlerted: boolean;
  restartAlertCount: number;
};

test.describe.configure({ mode: "serial" });

test.describe("account and session security — T056", () => {
  test("uses real step-up and preserves one frontend operation through timeout/network retry", async ({
    adminPage,
    adminAuth,
  }) => {
    const scenario = await adminE2eControl<AccountScenario>(
      "create-account",
      adminAuth.runId,
    );
    const decoy = await adminE2eControl<AccountScenario>(
      "create-account",
      adminAuth.runId,
    );
    await adminE2eControl("expire-proof", adminAuth.grantId);
    const origin =
      process.env.ADMIN_E2E_ORIGIN ?? "http://console.admin.localhost:3001";
    const commandUrl = `/api/admin/accounts/${scenario.accountId}/suspend`;
    const operationIds: string[] = [];
    let abortAfterStepUp = false;
    await adminPage.route(`**${commandUrl}`, async (route) => {
      operationIds.push(route.request().headers()["idempotency-key"] ?? "");
      if (abortAfterStepUp) {
        abortAfterStepUp = false;
        await route.abort("connectionreset");
      } else {
        await route.continue();
      }
    });
    await adminPage.goto(`${origin}/#/accounts`);
    await adminPage
      .getByLabel("Account reference, name, or exact email")
      .fill(scenario.accountId);
    await expect(
      adminPage.getByText(scenario.accountId, { exact: true }),
    ).toBeVisible();
    await expect(
      adminPage.getByText(decoy.accountId, { exact: true }),
    ).toHaveCount(0);
    await adminPage.getByText(scenario.accountId, { exact: true }).click();
    await expect(
      adminPage.getByRole("heading", { name: scenario.displayName }),
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "Suspend account" }).click();
    const dialog = adminPage.getByRole("dialog", { name: "Suspend account" });
    await expect(dialog).toContainText(scenario.accountId);
    await expect(dialog).not.toContainText(decoy.accountId);
    await dialog.getByLabel("Reason category").click();
    await adminPage
      .getByRole("option", { name: "SECURITY_COMPROMISE" })
      .click();
    await dialog
      .getByLabel("Private administrator explanation")
      .fill("Confirmed E2E account security investigation.");
    await dialog
      .getByRole("button", { name: "Suspend", exact: true })
      .dblclick();
    const stepUp = adminPage.getByRole("dialog", {
      name: "Confirm sensitive action",
    });
    await expect(stepUp).toBeVisible();
    abortAfterStepUp = true;
    const stepUpCode = await freshTotp(
      adminAuth.totpSecret,
      adminAuth.lastLoginTotpCode ?? "",
    );
    await stepUp.getByLabel("Six-digit authenticator code").fill(stepUpCode);
    await stepUp.getByRole("button", { name: "Verify" }).click();
    await expect(stepUp).toBeHidden();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(adminPage.getByText("SUSPENDED", { exact: true })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    expect(operationIds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(operationIds).size).toBe(1);
    expect(operationIds[0]).toMatch(/^[0-9a-f-]{36}$/u);

    await adminE2eControl("dispatch-security");
    const state = await queryAdminE2eState<AccountSecurityState>(
      "account",
      scenario.accountId,
    );
    expect(state.account.sessions.every((session) => session.revokedAt)).toBe(
      true,
    );
    expect(state.works).toHaveLength(1);
    const outboxId = state.works[0]?.emailOutbox?.id;
    expect(outboxId).toBeTruthy();
    const delivered = await adminE2eControl<DeliveryResult>(
      "drive-email",
      outboxId!,
      "SUCCESS",
    );
    expect(
      delivered.transitions.at(-1),
      JSON.stringify(delivered),
    ).toMatchObject({ status: "SENT", workStatus: "DELIVERED" });
    const text = delivered.messages[0]?.text ?? "";
    expect(text).toMatch(/SUSPENDED|suspended/u);
    expect(text).toMatch(/sessions.*revoked/iu);
    expect(text).toMatch(/support|appeal/iu);
    expect(text).not.toMatch(
      /fraud|administrator explanation|admin identity/iu,
    );

    await adminPage.getByRole("button", { name: "Reinstate account" }).click();
    const reinstateDialog = adminPage.getByRole("dialog", {
      name: "Reinstate account",
    });
    await reinstateDialog.getByLabel("Reason category").click();
    await adminPage.getByRole("option", { name: "INCIDENT_RESOLVED" }).click();
    await reinstateDialog
      .getByLabel("Private administrator explanation")
      .fill("Confirmed E2E account security incident resolution.");
    await reinstateDialog
      .getByRole("button", { name: "Reinstate", exact: true })
      .click();
    await expect(adminPage.getByText("ACTIVE", { exact: true })).toBeVisible();
    await adminE2eControl("dispatch-security");
    const reinstatedState = await queryAdminE2eState<AccountSecurityState>(
      "account",
      scenario.accountId,
    );
    const reinstated = reinstatedState.works.find(
      (work) => work.kind === "ACCOUNT_REINSTATED",
    );
    expect(reinstatedState.works).toHaveLength(2);
    expect(reinstated?.emailOutbox?.id).toBeTruthy();
    const reinstatedDelivery = await adminE2eControl<DeliveryResult>(
      "drive-email",
      reinstated!.emailOutbox!.id,
      "SUCCESS",
    );
    expect(reinstatedDelivery.transitions.at(-1)).toMatchObject({
      status: "SENT",
      workStatus: "DELIVERED",
    });
    const reinstatedText = reinstatedDelivery.messages[0]?.text ?? "";
    expect(reinstatedText).toMatch(/account is ACTIVE/iu);
    expect(reinstatedText).toMatch(/sign in again|old sessions/iu);
    expect(reinstatedText).toMatch(
      /memberships suspended separately are not restored automatically/iu,
    );
  });

  test("moves permanent provider failure to DEAD/manual intervention and alerts once across restart", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<AccountScenario>(
      "create-account",
      adminAuth.runId,
    );
    await adminE2eControl(
      "suspend-account",
      adminAuth.userId,
      scenario.accountId,
      randomUUID(),
    );
    await adminE2eControl("dispatch-security");
    const state = await queryAdminE2eState<AccountSecurityState>(
      "account",
      scenario.accountId,
    );
    const outboxId = state.works[0]?.emailOutbox?.id;
    expect(outboxId).toBeTruthy();
    const failed = await adminE2eControl<DeliveryResult>(
      "drive-email",
      outboxId!,
      "PERMANENT_FAILURE",
    );
    expect(failed.transitions.map((row) => row.status)).toEqual([
      "RETRYABLE",
      "RETRYABLE",
      "RETRYABLE",
      "RETRYABLE",
      "DEAD",
    ]);
    expect(
      failed.transitions
        .slice(1)
        .map(
          (row, index) =>
            new Date(row.at).getTime() -
            new Date(failed.transitions[index]!.at).getTime(),
        ),
    ).toEqual([60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]);
    expect(failed.transitions.at(-1)?.workStatus).toBe(
      "MANUAL_INTERVENTION_REQUIRED",
    );
    expect(failed.alertCount).toBe(1);
    expect(failed.restartAlerted).toBe(false);
    expect(failed.restartAlertCount).toBe(0);
  });

  test("creates no outbox work for one session and exactly one for all sessions", async ({
    adminPage,
    adminAuth,
  }) => {
    void adminPage;
    const scenario = await adminE2eControl<AccountScenario>(
      "create-account",
      adminAuth.runId,
    );
    const result = await adminE2eControl<{
      afterOne: number;
      kinds: string[];
    }>("account-cardinality", adminAuth.userId, scenario.accountId);
    expect(result.afterOne).toBe(0);
    expect(result.kinds).toEqual(["ALL_SESSIONS_REVOKED"]);
    await adminE2eControl("dispatch-security");
    const state = await queryAdminE2eState<AccountSecurityState>(
      "account",
      scenario.accountId,
    );
    expect(state.singleSessionAudits).toBe(1);
    expect(state.allSessionAudits).toBe(1);
    expect(state.works).toHaveLength(1);
    expect(state.works[0]?.emailOutbox?.idempotencyKey).toMatch(
      /^email-delivery:account:/u,
    );

    const staleScenario = await adminE2eControl<AccountScenario>(
      "create-account",
      adminAuth.runId,
    );
    const origin =
      process.env.ADMIN_E2E_ORIGIN ?? "http://console.admin.localhost:3001";
    await adminPage.goto(
      `${origin}/#/accounts/${staleScenario.accountId}/show`,
    );
    await adminPage.getByRole("button", { name: "Suspend account" }).click();
    const staleDialog = adminPage.getByRole("dialog", {
      name: "Suspend account",
    });
    await staleDialog.getByLabel("Reason category").click();
    await adminPage
      .getByRole("option", { name: "SECURITY_COMPROMISE" })
      .click();
    await staleDialog
      .getByLabel("Private administrator explanation")
      .fill("Concurrent E2E stale account command check.");
    await adminE2eControl(
      "suspend-account",
      adminAuth.userId,
      staleScenario.accountId,
      randomUUID(),
    );
    await staleDialog
      .getByRole("button", { name: "Suspend", exact: true })
      .click();
    await expect(
      adminPage.getByText(
        "The target changed before this command committed. Review the current state before trying again.",
      ),
    ).toBeVisible();
    await adminE2eControl("dispatch-security");
    const staleState = await queryAdminE2eState<AccountSecurityState>(
      "account",
      staleScenario.accountId,
    );
    expect(staleState.works).toHaveLength(1);
  });
});
