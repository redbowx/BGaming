import { isTauriRuntime } from "../utils/tauriRuntime";
import { runMigrations } from "./migrations";
import { seedDefaultSettings } from "./repositories/settingsRepository";

let readyPromise: Promise<void> | null = null;

export async function ensureDatabaseReady() {
  if (!isTauriRuntime()) {
    return;
  }

  if (!readyPromise) {
    readyPromise = prepareDatabase();
  }

  return readyPromise;
}

async function prepareDatabase() {
  await runMigrations();
  await seedDefaultSettings();
}
