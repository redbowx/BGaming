import { initializeDatabase } from "../database/initialize";
import { isTauriRuntime } from "../utils/tauriRuntime";

export type LibraryInitializationResult =
  | { status: "ready" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: unknown };

export async function initializeLibraryData(): Promise<LibraryInitializationResult> {
  if (!isTauriRuntime()) {
    return {
      status: "skipped",
      reason: "SQLite initialization runs inside the Tauri runtime.",
    };
  }

  try {
    await initializeDatabase();
    return { status: "ready" };
  } catch (error) {
    return { status: "failed", error };
  }
}
