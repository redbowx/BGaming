import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function getStartupLaunchEnabled(fallback: boolean) {
  if (!isTauriRuntime()) {
    return fallback;
  }

  return isEnabled();
}

export async function setStartupLaunchEnabled(enabled: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}
