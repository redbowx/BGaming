import { getDatabase } from "../client";
import type { Platform } from "../../types/game";

type PlatformRow = {
  id: number;
  name: string;
  logo_path: string | null;
};

export async function findAllPlatforms(): Promise<Platform[]> {
  const database = await getDatabase();
  const rows = await database.select<PlatformRow[]>(
    "SELECT id, name, logo_path FROM platforms ORDER BY name ASC",
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    logoPath: row.logo_path,
  }));
}

export async function insertPlatform(name: string, logoPath: string | null = null) {
  const database = await getDatabase();

  await database.execute(
    "INSERT OR IGNORE INTO platforms (name, logo_path) VALUES ($1, $2)",
    [name, logoPath],
  );
}

export async function ensurePlatform(name: string) {
  await insertPlatform(name);
}

export async function replaceGamePlatforms(gameId: number, platformNames: string[]) {
  const database = await getDatabase();

  await database.execute("DELETE FROM game_platforms WHERE game_id = $1", [gameId]);

  for (const platformName of platformNames) {
    const cleanName = platformName.trim();
    if (!cleanName) continue;

    await ensurePlatform(cleanName);
    await database.execute(
      `
        INSERT OR IGNORE INTO game_platforms (game_id, platform_id)
        SELECT $1, id FROM platforms WHERE name = $2
      `,
      [gameId, cleanName],
    );
  }
}

export async function linkGameToPlatform(gameTitle: string, platformName: string) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT OR IGNORE INTO game_platforms (game_id, platform_id)
      SELECT games.id, platforms.id
      FROM games, platforms
      WHERE games.normalized_title = $1
        AND platforms.name = $2
    `,
    [gameTitle, platformName],
  );
}
