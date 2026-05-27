import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function selectAndStoreCover(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<string | null>("select_and_store_cover");
}

export async function deleteStoredCover(path: string) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("delete_cover_file", { path });
}
