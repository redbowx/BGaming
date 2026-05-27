import { getDatabase } from "../client";
import type { Genre } from "../../types/game";

type GenreRow = {
  id: number;
  name: string;
};

export async function findAllGenres(): Promise<Genre[]> {
  const database = await getDatabase();
  const rows = await database.select<GenreRow[]>("SELECT id, name FROM genres ORDER BY name ASC");

  return rows;
}

export async function insertGenre(name: string) {
  const database = await getDatabase();

  await database.execute("INSERT OR IGNORE INTO genres (name) VALUES ($1)", [name]);
}

export async function ensureGenre(name: string) {
  await insertGenre(name);
}

export async function replaceGameGenres(gameId: number, genreNames: string[]) {
  const database = await getDatabase();

  await database.execute("DELETE FROM game_genres WHERE game_id = $1", [gameId]);

  for (const genreName of genreNames) {
    const cleanName = genreName.trim();
    if (!cleanName) continue;

    await ensureGenre(cleanName);
    await database.execute(
      `
        INSERT OR IGNORE INTO game_genres (game_id, genre_id)
        SELECT $1, id FROM genres WHERE name = $2
      `,
      [gameId, cleanName],
    );
  }
}

export async function linkGameToGenre(gameTitle: string, genreName: string) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT OR IGNORE INTO game_genres (game_id, genre_id)
      SELECT games.id, genres.id
      FROM games, genres
      WHERE games.normalized_title = $1
        AND genres.name = $2
    `,
    [gameTitle, genreName],
  );
}
