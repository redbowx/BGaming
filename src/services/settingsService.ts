import {
  defaultSettings,
  getSettings,
  updateSettings,
} from "../database/repositories/settingsRepository";
import { ensureDatabaseReady } from "../database/ready";
import type { AppSettings } from "../types/settings";
import { isTauriRuntime } from "../utils/tauriRuntime";

const localStorageKey = "bgaming.settings";

export async function getAppSettings(): Promise<AppSettings> {
  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    return getSettings();
  }

  return getLocalSettings();
}

export async function saveAppSettings(settings: Partial<AppSettings>) {
  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    await updateSettings(settings);
    return;
  }

  const currentSettings = getLocalSettings();
  window.localStorage.setItem(
    localStorageKey,
    JSON.stringify({ ...currentSettings, ...settings }),
  );
}

function getLocalSettings(): AppSettings {
  const rawSettings = window.localStorage.getItem(localStorageKey);

  if (!rawSettings) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(rawSettings) } as AppSettings;
  } catch {
    return defaultSettings;
  }
}
