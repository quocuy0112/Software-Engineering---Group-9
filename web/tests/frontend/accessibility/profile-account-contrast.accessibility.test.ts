import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function rgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function luminance(hex: string): number {
  const weights = [0.2126, 0.7152, 0.0722];
  return rgb(hex)
    .map((component) => component / 255)
    .map((component) =>
      component <= 0.03928
        ? component / 12.92
        : ((component + 0.055) / 1.055) ** 2.4,
    )
    .reduce((total, component, index) => total + component * weights[index], 0);
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function variable(css: string, name: string): string {
  const value = css.match(
    new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, "u"),
  )?.[1];
  if (!value) throw new Error(`Missing CSS variable --${name}`);
  return value;
}

describe("profile and account contrast", () => {
  const tokens = readFileSync(
    resolve(process.cwd(), "src/frontend/styles/tokens.css"),
    "utf8",
  );
  const surface = variable(tokens, "surface");
  const forest = variable(tokens, "forest");
  const focusRing = variable(tokens, "focus-ring");
  const controlBorder = variable(tokens, "control-border");

  it.each([
    ["primary text", variable(tokens, "ink"), surface],
    ["secondary text", variable(tokens, "muted"), surface],
    ["primary button", "#ffffff", forest],
    ["section kicker", variable(tokens, "violet"), surface],
    ["field label", "#394137", "#fbfbf9"],
    ["success feedback", "#315e3f", "#edf8f0"],
    ["warning feedback", "#6d5724", "#fff9e5"],
    ["error feedback", variable(tokens, "danger"), "#fff1f1"],
    ["account link", "#5e4e99", surface],
  ])("%s text meets 4.5:1", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["focus ring on light surface", focusRing, surface],
    ["focus ring on primary control", focusRing, forest],
    ["control boundary on surface", controlBorder, surface],
    ["control boundary on input fill", controlBorder, "#fbfbf9"],
  ])("%s meets 3:1", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it("routes every profile/account focus and control boundary through the reviewed tokens", () => {
    const sources = [
      "src/frontend/styles/profile.css",
      "src/frontend/styles/workspace.css",
      "src/frontend/features/profile/styles/professional-profile.css",
      "src/frontend/features/profile/styles/account-identity-email-change.css",
      "src/frontend/features/profile/styles/account-preferences.css",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));

    expect(sources.join("\n")).not.toMatch(
      /#f59e0b|#c49b45|#cfd4ca|#d9dcd4|#8b6ab8/u,
    );
    expect(sources.join("\n")).toContain("var(--focus-ring)");
    expect(sources.join("\n")).toContain("var(--control-border)");
  });
});
