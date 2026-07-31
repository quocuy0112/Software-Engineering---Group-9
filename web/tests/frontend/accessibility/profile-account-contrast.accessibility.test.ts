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
  const surface = variable(tokens, "sh-color-surface-card");
  const primary = variable(tokens, "sh-color-brand-primary");
  const focusBorder = variable(tokens, "sh-color-border-focus");
  const focusHalo = variable(tokens, "sh-color-focus-ring-bg");
  const controlBorder = variable(tokens, "sh-color-border-default");

  it.each([
    ["primary text", variable(tokens, "sh-color-text-primary"), surface],
    ["secondary text", variable(tokens, "sh-color-text-secondary"), surface],
    ["primary button", variable(tokens, "sh-color-text-inverse"), primary],
    ["section kicker", primary, surface],
    ["field label", variable(tokens, "sh-color-text-primary"), surface],
    [
      "success feedback",
      variable(tokens, "sh-color-success"),
      variable(tokens, "sh-color-success-bg"),
    ],
    [
      "warning feedback",
      variable(tokens, "sh-color-warning"),
      variable(tokens, "sh-color-warning-bg"),
    ],
    [
      "error feedback",
      variable(tokens, "sh-color-error"),
      variable(tokens, "sh-color-error-bg"),
    ],
    ["account link", primary, surface],
  ])("%s text meets 4.5:1", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["focus border on light surface", focusBorder, surface],
    ["focus halo on primary control", focusHalo, primary],
    ["control boundary on surface", controlBorder, surface],
    ["control boundary on input fill", controlBorder, surface],
  ])("%s meets 3:1", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it("routes every profile/account focus and control boundary through the reviewed tokens", () => {
    const sources = [
      "src/frontend/styles/base.css",
      "src/frontend/styles/profile.css",
      "src/frontend/styles/workspace.css",
      "src/frontend/features/profile/styles/professional-profile.css",
      "src/frontend/features/profile/styles/account-identity-email-change.css",
      "src/frontend/features/profile/styles/account-preferences.css",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));

    expect(sources.join("\n")).not.toMatch(
      /#f59e0b|#c49b45|#cfd4ca|#d9dcd4|#8b6ab8/u,
    );
    expect(sources.join("\n")).not.toMatch(
      /var\(--(?:focus-ring|control-border|forest|ink|muted|danger)\)/u,
    );
    expect(sources.join("\n")).toContain("var(--sh-color-border-focus)");
    expect(sources.join("\n")).toContain("var(--sh-color-border-default)");
  });
});
