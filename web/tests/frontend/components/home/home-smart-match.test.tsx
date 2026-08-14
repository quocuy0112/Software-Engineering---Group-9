import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeSmartMatch } from "@/frontend/features/home/components/home-smart-match";
import {
  candidateViewer,
  homeModel,
  personalMatch,
} from "../../../helpers/home/home-fixtures";

describe("Home Smart Match", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders the animated CV-to-role illustration and accessible composition", () => {
    const { container } = render(
      <HomeSmartMatch model={homeModel()} locale="en" />,
    );

    expect(screen.getByText("AI Smart Match")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Fit estimate: 82%" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".home-match-connectors"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".home-match-score-progress"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".home-match-score-orbit"),
    ).toBeInTheDocument();
    const connectorPaths = container.querySelectorAll(
      ".home-match-connectors path",
    );
    expect(connectorPaths).toHaveLength(2);
    expect(connectorPaths.item(0)).toHaveAttribute(
      "d",
      "M55 32C110 32 130 110 170 150",
    );
    expect(connectorPaths.item(1)).toHaveAttribute(
      "d",
      "M285 32C230 32 210 110 170 150",
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Skills: 38%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Insufficient data: 18%" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skills: 38%" })).toHaveAttribute(
      "data-tooltip",
      "Skills: 38%",
    );
  });

  it("uses the current candidate, role, score, and explanation binding for a personal estimate", () => {
    const match = personalMatch({ score: 75 });
    const { container } = render(
      <HomeSmartMatch
        model={homeModel({ viewer: candidateViewer, match })}
        locale="en"
      />,
    );

    expect(screen.getByText(candidateViewer.displayName)).toBeInTheDocument();
    expect(screen.getByText(match.jobTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Fit estimate: 75%" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(`#smart-match-explanation-${match.jobSlug}`),
    ).toBeInTheDocument();
  });
});
