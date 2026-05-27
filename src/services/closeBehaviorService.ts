import { invoke } from "@tauri-apps/api/core";
import type { CloseButtonBehavior } from "../types/settings";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function applyCloseButtonBehavior(behavior: CloseButtonBehavior) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("set_close_button_behavior", {
    minimizeToTray: behavior === "background",
  });
}
