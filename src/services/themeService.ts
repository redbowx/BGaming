import { getAppSettings, saveAppSettings } from "./settingsService";
import type { AccentTheme, ThemeMode } from "../types/theme";

export type ThemePreferences = {
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  customAccentFrom: string;
  customAccentTo: string;
};

export async function getThemePreferences(): Promise<ThemePreferences> {
  const settings = await getAppSettings();

  return {
    themeMode: settings.themeMode,
    accentTheme: settings.accentTheme,
    customAccentFrom: settings.customAccentFrom,
    customAccentTo: settings.customAccentTo,
  };
}

export async function saveThemePreferences(preferences: ThemePreferences) {
  await saveAppSettings(preferences);
}

export function applyThemePreferences(preferences: ThemePreferences) {
  const root = document.documentElement;

  root.dataset.theme = preferences.themeMode;
  root.dataset.accentTheme = preferences.accentTheme;
  root.style.colorScheme = preferences.themeMode;
  root.style.setProperty("--custom-accent", preferences.customAccentFrom);
  root.style.setProperty("--custom-accent-2", preferences.customAccentTo);
}
