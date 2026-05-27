import { getDatabase } from "../client";
import { defaultSettings } from "./settingsRepository";
import type { AppSettings, SettingsKey } from "../../types/settings";

export async function resetUserData() {
  const database = await getDatabase();
  const settingsEntries = Object.entries(defaultSettings) as Array<[SettingsKey, AppSettings[SettingsKey]]>;

  await database.execute("BEGIN TRANSACTION");

  try {
    await database.execute("DELETE FROM duplicate_candidates");
    await database.execute("DELETE FROM wishlist");
    await database.execute("DELETE FROM game_genres");
    await database.execute("DELETE FROM game_platforms");
    await database.execute("DELETE FROM games");
    await database.execute("DELETE FROM genres");
    await database.execute("DELETE FROM platforms");
    await database.execute("DELETE FROM settings");

    for (const [key, value] of settingsEntries) {
      await database.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [key, String(value)]);
    }

    await database.execute("COMMIT");
  } catch (error) {
    await database.execute("ROLLBACK");
    throw error;
  }
}
