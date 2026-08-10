import { render } from "@testing-library/react";
import { RecordContextProvider } from "react-admin";
import { describe, expect, it, vi } from "vitest";
import { AccountStateDialog } from "@/frontend/features/admin/accounts/account-state-dialog";
import {
  AccessRolesField,
  AccessRolesLegend,
} from "@/frontend/features/admin/accounts/access-roles-field";

describe("account security accessibility", () => {
  it("exposes full text alternatives for compact access-role badges", async () => {
    const { container } = render(
      <>
        <AccessRolesLegend />
        <RecordContextProvider
          value={{
            id: "account-1",
            hasCandidateIdentity: true,
            activeMembershipCount: 1,
            hasActiveAdministratorGrant: true,
          }}
        >
          <AccessRolesField />
        </RecordContextProvider>
      </>,
    );
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });

  it("has no serious or critical violations in the confirmation dialog", async () => {
    const { container } = render(
      <AccountStateDialog
        open
        title="Suspend account"
        actionLabel="Suspend"
        targetLabel="Candidate 42"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
