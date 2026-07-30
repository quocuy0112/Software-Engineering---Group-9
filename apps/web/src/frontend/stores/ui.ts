export type UiState = Readonly<{
  navigationOpen: boolean;
  activeSettingsPanel: "security" | "sessions";
}>;
export const initialUiState: UiState = {
  navigationOpen: false,
  activeSettingsPanel: "security",
};
export const permittedUiStateKeys = Object.freeze([
  "navigationOpen",
  "activeSettingsPanel",
] as const);
