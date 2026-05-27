import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../utils/tauriRuntime";

export async function backupLibrary(): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Yedekleme sadece masaustu uygulamasinda calisir.");
  }

  const backupPath = await invoke<string | null>("backup_library");
  if (!backupPath) {
    return "";
  }

  return backupPath;
}

export async function selectBackupFolder(): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Geri yükleme sadece masaustu uygulamasinda calisir.");
  }

  const backupPath = await invoke<string | null>("select_backup_folder");
  if (!backupPath) {
    return "";
  }

  return backupPath;
}

export async function restoreLibraryBackup(backupPath: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Geri yükleme sadece masaustu uygulamasinda calisir.");
  }

  return invoke<string>("restore_library_backup", { backupPath });
}
