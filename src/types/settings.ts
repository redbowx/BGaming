import type { AccentTheme, ThemeMode } from "./theme";

export type GridColumns = 4 | 5 | 6;
export type CloseButtonBehavior = "background" | "quit";

export type SettingsKey =
  | "themeMode"
  | "accentTheme"
  | "smartRandomEnabled"
  | "gridColumns"
  | "showAllGames"
  | "steamApiKey"
  | "steamProfile"
  | "metadataApiKey"
  | "steamGridDbApiKey"
  | "drawGenreKeys"
  | "customAccentFrom"
  | "customAccentTo"
  | "quickLauncherWidgetEnabled"
  | "surpriseWidgetEnabled"
  | "quickLauncherWidgetPinned"
  | "quickLauncherWidgetPositionX"
  | "quickLauncherWidgetPositionY"
  | "surpriseWidgetPinned"
  | "surpriseWidgetPositionX"
  | "surpriseWidgetPositionY"
  | "widgetsAlwaysOnTop"
  | "launchAtStartup"
  | "closeButtonBehavior"
  | "autoCompleteMissingCovers"
  | "autoCompleteMissingGenres"
  | "autoCompleteMissingYears";

export type AppSettings = {
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  smartRandomEnabled: boolean;
  gridColumns: GridColumns;
  showAllGames: boolean;
  steamApiKey: string;
  steamProfile: string;
  metadataApiKey: string;
  steamGridDbApiKey: string;
  drawGenreKeys: string[];
  customAccentFrom: string;
  customAccentTo: string;
  quickLauncherWidgetEnabled: boolean;
  surpriseWidgetEnabled: boolean;
  quickLauncherWidgetPinned: boolean;
  quickLauncherWidgetPositionX: number | null;
  quickLauncherWidgetPositionY: number | null;
  surpriseWidgetPinned: boolean;
  surpriseWidgetPositionX: number | null;
  surpriseWidgetPositionY: number | null;
  widgetsAlwaysOnTop: boolean;
  launchAtStartup: boolean;
  closeButtonBehavior: CloseButtonBehavior;
  autoCompleteMissingCovers: boolean;
  autoCompleteMissingGenres: boolean;
  autoCompleteMissingYears: boolean;
};

export type SettingRecord = {
  key: SettingsKey;
  value: string;
};
