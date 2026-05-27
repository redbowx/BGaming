import { getDatabase } from "../client";
import type { AppSettings, SettingRecord, SettingsKey } from "../../types/settings";
import { defaultDrawGenreKeys, parseDrawGenreKeys, serializeDrawGenreKeys } from "../../utils/drawGenreOptions";

export const defaultSettings: AppSettings = {
  themeMode: "dark",
  accentTheme: "purpleNeon",
  smartRandomEnabled: true,
  gridColumns: 5,
  showAllGames: true,
  steamApiKey: "",
  steamProfile: "",
  metadataApiKey: "",
  steamGridDbApiKey: "",
  drawGenreKeys: defaultDrawGenreKeys,
  customAccentFrom: "#a855f7",
  customAccentTo: "#22d3ee",
  quickLauncherWidgetEnabled: false,
  surpriseWidgetEnabled: false,
  quickLauncherWidgetPinned: false,
  quickLauncherWidgetPositionX: null,
  quickLauncherWidgetPositionY: null,
  surpriseWidgetPinned: false,
  surpriseWidgetPositionX: null,
  surpriseWidgetPositionY: null,
  widgetsAlwaysOnTop: false,
  launchAtStartup: false,
  closeButtonBehavior: "background",
  autoCompleteMissingCovers: false,
  autoCompleteMissingGenres: false,
  autoCompleteMissingYears: false,
};

export async function seedDefaultSettings() {
  const database = await getDatabase();
  const entries = Object.entries(defaultSettings) as Array<[SettingsKey, AppSettings[SettingsKey]]>;

  for (const [key, value] of entries) {
    await database.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)", [
      key,
      serializeSettingValue(key, value),
    ]);
  }
}

export async function getSettings(): Promise<AppSettings> {
  const database = await getDatabase();
  const rows = await database.select<SettingRecord[]>("SELECT key, value FROM settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    themeMode: values.get("themeMode") === "light" ? "light" : "dark",
    accentTheme: parseAccentTheme(values.get("accentTheme")),
    smartRandomEnabled: values.get("smartRandomEnabled") !== "false",
    gridColumns: parseGridColumns(values.get("gridColumns")),
    showAllGames: values.get("showAllGames") !== "false",
    steamApiKey: values.get("steamApiKey") ?? "",
    steamProfile: values.get("steamProfile") ?? "",
    metadataApiKey: values.get("metadataApiKey") ?? "",
    steamGridDbApiKey: values.get("steamGridDbApiKey") ?? "",
    drawGenreKeys: parseDrawGenreKeys(values.get("drawGenreKeys")),
    customAccentFrom: parseAccentColor(values.get("customAccentFrom"), "#a855f7"),
    customAccentTo: parseAccentColor(values.get("customAccentTo"), "#22d3ee"),
    quickLauncherWidgetEnabled: values.get("quickLauncherWidgetEnabled") === "true",
    surpriseWidgetEnabled: values.get("surpriseWidgetEnabled") === "true",
    quickLauncherWidgetPinned: values.get("quickLauncherWidgetPinned") === "true",
    quickLauncherWidgetPositionX: parseWindowPosition(values.get("quickLauncherWidgetPositionX")),
    quickLauncherWidgetPositionY: parseWindowPosition(values.get("quickLauncherWidgetPositionY")),
    surpriseWidgetPinned: values.get("surpriseWidgetPinned") === "true",
    surpriseWidgetPositionX: parseWindowPosition(values.get("surpriseWidgetPositionX")),
    surpriseWidgetPositionY: parseWindowPosition(values.get("surpriseWidgetPositionY")),
    widgetsAlwaysOnTop: false,
    launchAtStartup: values.get("launchAtStartup") === "true",
    closeButtonBehavior: values.get("closeButtonBehavior") === "quit" ? "quit" : "background",
    autoCompleteMissingCovers: values.get("autoCompleteMissingCovers") === "true",
    autoCompleteMissingGenres: values.get("autoCompleteMissingGenres") === "true",
    autoCompleteMissingYears: values.get("autoCompleteMissingYears") === "true",
  };
}

export async function updateSetting(key: SettingsKey, value: AppSettings[SettingsKey]) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT INTO settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, serializeSettingValue(key, value)],
  );
}

export async function updateSettings(settings: Partial<AppSettings>) {
  const entries = Object.entries(settings) as Array<[SettingsKey, AppSettings[SettingsKey]]>;

  for (const [key, value] of entries) {
    await updateSetting(key, value);
  }
}

function parseAccentTheme(value: string | undefined): AppSettings["accentTheme"] {
  const allowed = ["purpleNeon", "orange", "blue", "green", "gray", "red", "pink", "teal", "custom"];

  return allowed.includes(value ?? "") ? (value as AppSettings["accentTheme"]) : "purpleNeon";
}

function parseGridColumns(value: string | undefined): AppSettings["gridColumns"] {
  const parsed = Number(value);

  return parsed === 4 || parsed === 6 ? parsed : 5;
}

function serializeSettingValue(key: SettingsKey, value: AppSettings[SettingsKey]) {
  if (key === "drawGenreKeys") {
    return serializeDrawGenreKeys(Array.isArray(value) ? value : defaultDrawGenreKeys);
  }

  return String(value);
}

function parseAccentColor(value: string | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value ?? fallback : fallback;
}

function parseWindowPosition(value: string | undefined) {
  const position = Number(value);

  return Number.isFinite(position) ? position : null;
}
