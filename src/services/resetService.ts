import { invoke } from "@tauri-apps/api/core";
import { resetUserData } from "../database/repositories/userDataRepository";
import { ensureDatabaseReady } from "../database/ready";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function resetApplicationData() {
  if (!isTauriRuntime()) {
    window.localStorage.clear();
    return;
  }

  await ensureDatabaseReady();
  await resetUserData();
  await invoke("clear_user_data_files");
}
