import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function setMiniWindowMode(enabled: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("set_mini_mode", { enabled });
}
