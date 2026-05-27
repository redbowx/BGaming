import { getDatabase } from "./client";

export async function runMigrations() {
  const database = await getDatabase();

  for (const statement of migrationStatements) {
    await database.execute(statement);
  }

  await addColumnIfMissing(
    "games",
    "estimated_length",
    "ALTER TABLE games ADD COLUMN estimated_length TEXT NOT NULL DEFAULT 'unknown' CHECK (estimated_length IN ('short', 'medium', 'long', 'unknown'))",
  );
  await addColumnIfMissing("games", "external_source", "ALTER TABLE games ADD COLUMN external_source TEXT");
  await addColumnIfMissing("games", "external_id", "ALTER TABLE games ADD COLUMN external_id TEXT");
  await addColumnIfMissing(
    "games",
    "turkish_language_support",
    "ALTER TABLE games ADD COLUMN turkish_language_support TEXT NOT NULL DEFAULT 'unknown' CHECK (turkish_language_support IN ('yes', 'no', 'unknown'))",
  );
  await addColumnIfMissing(
    "games",
    "turkish_patch_available",
    "ALTER TABLE games ADD COLUMN turkish_patch_available INTEGER NOT NULL DEFAULT 0",
  );
  await database.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_games_external_source_id ON games(external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL",
  );
  await database.execute(
    "UPDATE games SET use_placeholder_cover = 0 WHERE cover_path IS NOT NULL AND TRIM(cover_path) <> ''",
  );
}

async function addColumnIfMissing(tableName: string, columnName: string, statement: string) {
  const database = await getDatabase();
  const columns = await database.select<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);

  if (!columns.some((column) => column.name === columnName)) {
    await database.execute(statement);
  }
}

const migrationStatements = [
  `
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL UNIQUE,
      release_year INTEGER,
      cover_path TEXT,
      use_placeholder_cover INTEGER NOT NULL DEFAULT 1,
      personal_rating INTEGER CHECK (personal_rating IS NULL OR personal_rating BETWEEN 1 AND 10),
      notes TEXT,
      estimated_length TEXT NOT NULL DEFAULT 'unknown' CHECK (estimated_length IN ('short', 'medium', 'long', 'unknown')),
      turkish_language_support TEXT NOT NULL DEFAULT 'unknown' CHECK (turkish_language_support IN ('yes', 'no', 'unknown')),
      turkish_patch_available INTEGER NOT NULL DEFAULT 0,
      is_played INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_currently_playing INTEGER NOT NULL DEFAULT 0,
      is_abandoned INTEGER NOT NULL DEFAULT 0,
      is_installed INTEGER NOT NULL DEFAULT 0,
      never_show_in_random INTEGER NOT NULL DEFAULT 0,
      multiplayer_type TEXT NOT NULL DEFAULT 'unknown' CHECK (multiplayer_type IN ('singleplayer', 'multiplayer', 'both', 'unknown')),
      steam_deck_compatible TEXT NOT NULL DEFAULT 'unknown' CHECK (steam_deck_compatible IN ('yes', 'no', 'unknown')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'steam', 'import')),
      steam_app_id INTEGER,
      external_source TEXT,
      external_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      logo_path TEXT
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS game_platforms (
      game_id INTEGER NOT NULL,
      platform_id INTEGER NOT NULL,
      PRIMARY KEY (game_id, platform_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS game_genres (
      game_id INTEGER NOT NULL,
      genre_id INTEGER NOT NULL,
      PRIMARY KEY (game_id, genre_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS wishlist (
      game_id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS duplicate_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_a_id INTEGER NOT NULL,
      game_b_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')),
      FOREIGN KEY (game_a_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (game_b_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `,
  "CREATE INDEX IF NOT EXISTS idx_games_title ON games(normalized_title);",
  "CREATE INDEX IF NOT EXISTS idx_games_flags ON games(is_favorite, is_played, is_completed, is_currently_playing);",
  "CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_status ON duplicate_candidates(status);",
];
