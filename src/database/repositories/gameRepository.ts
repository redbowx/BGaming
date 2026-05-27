import { getDatabase } from "../client";
import { invoke } from "@tauri-apps/api/core";
import type { Game, GameFormInput, GameUpdateInput, NewGameInput } from "../../types/game";
import { runDatabaseWrite } from "../client";
import { closeDatabaseConnection } from "../client";
import { normalizeTitle } from "../../utils/normalizeTitle";
import { replaceGameGenres } from "./genreRepository";
import { replaceGamePlatforms } from "./platformRepository";

export type SteamGameImportInput = {
  appId: number;
  name: string;
  coverPath: string | null;
  coverDownloaded: boolean;
};

export type SteamImportSummary = {
  added: number;
  existing: number;
  duplicateCandidates: number;
  coversDownloaded: number;
  errors: number;
};

export type ImportedGameInput = {
  title: string;
  releaseYear: number | null;
  genreNames: string[];
  platformNames: string[];
  coverPath: string | null;
  isPlayed: boolean;
  isCompleted: boolean;
  isFavorite: boolean;
  isInstalled: boolean;
  notes: string | null;
  personalRating: number | null;
  externalId: string | null;
  externalSource: string | null;
};

export type FileImportSummary = {
  added: number;
  existing: number;
  updated: number;
  platformsUpdated: number;
  skipped: number;
  duplicateCandidates: number;
  errors: number;
};

type GameRow = {
  id: number;
  title: string;
  normalized_title: string;
  release_year: number | null;
  cover_path: string | null;
  use_placeholder_cover: number;
  personal_rating: number | null;
  notes: string | null;
  estimated_length: Game["estimatedLength"];
  turkish_language_support: Game["turkishLanguageSupport"];
  turkish_patch_available: number;
  is_played: number;
  is_completed: number;
  is_favorite: number;
  is_currently_playing: number;
  is_abandoned: number;
  is_installed: number;
  is_wishlisted?: number;
  never_show_in_random: number;
  multiplayer_type: Game["multiplayerType"];
  steam_deck_compatible: Game["steamDeckCompatible"];
  source: Game["source"];
  steam_app_id: number | null;
  external_source?: string | null;
  external_id?: string | null;
  created_at: string;
  updated_at: string;
  genre_names?: string | null;
  platform_names?: string | null;
};

export async function countGames() {
  const database = await getDatabase();
  const rows = await database.select<Array<{ count: number }>>("SELECT COUNT(*) as count FROM games");

  return rows[0]?.count ?? 0;
}

export async function findAllGames(): Promise<Game[]> {
  const database = await getDatabase();
  const rows = await database.select<GameRow[]>(
    `
      SELECT
        games.*,
        (
          SELECT GROUP_CONCAT(genres.name, '||')
          FROM game_genres
          JOIN genres ON genres.id = game_genres.genre_id
          WHERE game_genres.game_id = games.id
        ) AS genre_names,
        (
          SELECT GROUP_CONCAT(platforms.name, '||')
          FROM game_platforms
          JOIN platforms ON platforms.id = game_platforms.platform_id
          WHERE game_platforms.game_id = games.id
        ) AS platform_names
        ,
        CASE WHEN EXISTS (
          SELECT 1 FROM wishlist WHERE wishlist.game_id = games.id
        ) THEN 1 ELSE 0 END AS is_wishlisted
      FROM games
      ORDER BY title ASC
    `,
  );

  return rows.map(mapGameRow);
}

export async function findRandomEligibleGame(): Promise<Game | null> {
  const database = await getDatabase();
  const rows = await database.select<GameRow[]>(
    `
      SELECT *
      FROM games
      WHERE never_show_in_random = 0
        AND is_abandoned = 0
      ORDER BY RANDOM()
      LIMIT 1
    `,
  );

  return rows[0] ? mapGameRow(rows[0]) : null;
}

export async function insertGame(input: NewGameInput) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT OR IGNORE INTO games (
        title,
        normalized_title,
        release_year,
        cover_path,
        use_placeholder_cover,
        personal_rating,
        notes,
        estimated_length,
        turkish_language_support,
        turkish_patch_available,
        is_played,
        is_completed,
        is_favorite,
        is_currently_playing,
        is_abandoned,
        is_installed,
        never_show_in_random,
        multiplayer_type,
        steam_deck_compatible,
        source,
        steam_app_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    `,
    [
      input.title,
      input.normalizedTitle,
      input.releaseYear,
      input.coverPath,
      Number(input.usePlaceholderCover),
      input.personalRating,
      input.notes,
      input.estimatedLength,
      input.turkishLanguageSupport ?? "unknown",
      Number(input.turkishPatchAvailable ?? false),
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isCurrentlyPlaying),
      Number(input.isAbandoned),
      Number(input.isInstalled),
      Number(input.neverShowInRandom),
      input.multiplayerType,
      input.steamDeckCompatible,
      input.source,
      input.steamAppId,
    ],
  );
}

export async function createGame(input: GameFormInput): Promise<Game> {
  const database = await getDatabase();
  const normalizedTitle = normalizeTitle(input.title);

  await database.execute(
    `
      INSERT INTO games (
        title,
        normalized_title,
        release_year,
        cover_path,
        use_placeholder_cover,
        personal_rating,
        notes,
        estimated_length,
        turkish_language_support,
        turkish_patch_available,
        is_played,
        is_completed,
        is_favorite,
        is_currently_playing,
        is_abandoned,
        is_installed,
        never_show_in_random,
        multiplayer_type,
        steam_deck_compatible,
        source,
        steam_app_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, $16, $17, $18, 'manual', NULL)
    `,
    [
      input.title.trim(),
      normalizedTitle,
      input.releaseYear,
      input.coverPath,
      Number(input.usePlaceholderCover),
      input.personalRating,
      input.notes,
      input.estimatedLength,
      input.turkishLanguageSupport,
      Number(input.turkishPatchAvailable),
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isCurrentlyPlaying),
      Number(input.isAbandoned),
      Number(input.neverShowInRandom),
      input.multiplayerType,
      input.steamDeckCompatible,
    ],
  );

  const created = await findGameByNormalizedTitle(normalizedTitle);
  if (!created) {
    throw new Error("Game could not be created");
  }

  await replaceGameGenres(created.id, input.genreNames);
  await replaceGamePlatforms(created.id, input.platformNames);
  await setGameWishlist(created.id, input.isWishlisted);

  return (await findGameById(created.id)) ?? created;
}

export async function updateGameForm(input: GameFormInput & { id: number }): Promise<Game> {
  const database = await getDatabase();
  const normalizedTitle = normalizeTitle(input.title);
  const conflictingGame = await findGameByNormalizedTitle(normalizedTitle);

  if (conflictingGame && conflictingGame.id !== input.id) {
    await insertDuplicateCandidate(input.id, conflictingGame.id, "Name normalization match", 1);
    throw new Error(
      "Bu isimle kayıtlı başka bir oyun var. Koleksiyon Sağlığı ekranında duplicate olarak birleştirebilirsin.",
    );
  }

  await database.execute(
    `
      UPDATE games
      SET
        title = $1,
        normalized_title = $2,
        release_year = $3,
        cover_path = $4,
        use_placeholder_cover = $5,
        personal_rating = $6,
        notes = $7,
        estimated_length = $8,
        turkish_language_support = $9,
        turkish_patch_available = $10,
        is_played = $11,
        is_completed = $12,
        is_favorite = $13,
        is_currently_playing = $14,
        is_abandoned = $15,
        never_show_in_random = $16,
        multiplayer_type = $17,
        steam_deck_compatible = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
    `,
    [
      input.title.trim(),
      normalizedTitle,
      input.releaseYear,
      input.coverPath,
      Number(input.usePlaceholderCover),
      input.personalRating,
      input.notes,
      input.estimatedLength,
      input.turkishLanguageSupport,
      Number(input.turkishPatchAvailable),
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isCurrentlyPlaying),
      Number(input.isAbandoned),
      Number(input.neverShowInRandom),
      input.multiplayerType,
      input.steamDeckCompatible,
      input.id,
    ],
  );

  await replaceGameGenres(input.id, input.genreNames);
  await replaceGamePlatforms(input.id, input.platformNames);
  await setGameWishlist(input.id, input.isWishlisted);

  const updated = await findGameById(input.id);
  if (!updated) {
    throw new Error("Game not found after update");
  }

  return updated;
}

export async function deleteGame(gameId: number) {
  const database = await getDatabase();

  await database.execute("DELETE FROM duplicate_candidates WHERE game_a_id = $1 OR game_b_id = $1", [gameId]);
  await database.execute("DELETE FROM wishlist WHERE game_id = $1", [gameId]);
  await database.execute("DELETE FROM game_genres WHERE game_id = $1", [gameId]);
  await database.execute("DELETE FROM game_platforms WHERE game_id = $1", [gameId]);
  await database.execute("DELETE FROM games WHERE id = $1", [gameId]);
}

export async function countGamesUsingCover(coverPath: string) {
  const database = await getDatabase();
  const rows = await database.select<Array<{ count: number }>>(
    "SELECT COUNT(*) as count FROM games WHERE cover_path = $1",
    [coverPath],
  );

  return rows[0]?.count ?? 0;
}

async function findGameById(gameId: number): Promise<Game | null> {
  const games = await findAllGames();
  return games.find((game) => game.id === gameId) ?? null;
}

async function findGameByNormalizedTitle(normalizedTitle: string): Promise<Game | null> {
  const games = await findAllGames();
  return games.find((game) => game.normalizedTitle === normalizedTitle) ?? null;
}

export async function updateGame(input: GameUpdateInput) {
  const database = await getDatabase();

  await database.execute(
    `
      UPDATE games
      SET
        is_played = $1,
        is_completed = $2,
        is_favorite = $3,
        is_currently_playing = $4,
        is_abandoned = $5,
        never_show_in_random = $6,
        multiplayer_type = $7,
        steam_deck_compatible = $8,
        personal_rating = $9,
        notes = $10,
        estimated_length = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `,
    [
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isCurrentlyPlaying),
      Number(input.isAbandoned),
      Number(input.neverShowInRandom),
      input.multiplayerType,
      input.steamDeckCompatible,
      input.personalRating,
      input.notes,
      input.estimatedLength,
      input.id,
    ],
  );

  if ("releaseYear" in input) {
    await database.execute(
      "UPDATE games SET release_year = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [input.releaseYear ?? null, input.id],
    );
  }

  if ("isInstalled" in input) {
    await database.execute(
      "UPDATE games SET is_installed = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [Number(Boolean(input.isInstalled)), input.id],
    );
  }

  if ("turkishLanguageSupport" in input) {
    await database.execute(
      "UPDATE games SET turkish_language_support = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [input.turkishLanguageSupport ?? "unknown", input.id],
    );
  }

  if ("turkishPatchAvailable" in input) {
    await database.execute(
      "UPDATE games SET turkish_patch_available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [Number(Boolean(input.turkishPatchAvailable)), input.id],
    );
  }

  await setGameWishlist(input.id, input.isWishlisted);
}

export async function setGameWishlist(gameId: number, isWishlisted: boolean) {
  const database = await getDatabase();

  if (isWishlisted) {
    await database.execute("INSERT OR IGNORE INTO wishlist (game_id) VALUES ($1)", [gameId]);
    return;
  }

  await database.execute("DELETE FROM wishlist WHERE game_id = $1", [gameId]);
}

export async function importSteamGames(gamesToImport: SteamGameImportInput[]): Promise<SteamImportSummary> {
  const summary: SteamImportSummary = {
    added: 0,
    existing: 0,
    duplicateCandidates: 0,
    coversDownloaded: gamesToImport.filter((game) => game.coverDownloaded).length,
    errors: 0,
  };
  const knownGames = await findAllGames();

  for (const steamGame of gamesToImport) {
    try {
      const existingByAppId = knownGames.find((game) => game.steamAppId === steamGame.appId);
      if (existingByAppId) {
        await replaceGamePlatforms(existingByAppId.id, mergeNameLists(existingByAppId.platformNames, ["Steam"]));
        summary.existing += 1;
        continue;
      }

      const normalizedTitle = normalizeTitle(steamGame.name);
      const existingByTitle = knownGames.find((game) => game.normalizedTitle === normalizedTitle);

      if (existingByTitle) {
        await attachSteamToExistingGame(existingByTitle, steamGame.appId);
        summary.existing += 1;
        continue;
      }

      const createdGame = await createSteamGame(steamGame, normalizedTitle);
      await replaceGamePlatforms(createdGame.id, ["Steam"]);
      const duplicateCount = await createDuplicateCandidatesForSteamGame(createdGame, knownGames);
      summary.duplicateCandidates += duplicateCount;
      knownGames.push(createdGame);
      summary.added += 1;
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

export async function importExternalGames(gamesToImport: ImportedGameInput[]): Promise<FileImportSummary> {
  const summary: FileImportSummary = {
    added: 0,
    existing: 0,
    updated: 0,
    platformsUpdated: 0,
    skipped: 0,
    duplicateCandidates: 0,
    errors: 0,
  };
  const knownGames = await findAllGames();

  for (const importedGame of gamesToImport) {
    try {
      const title = importedGame.title.trim();
      if (!title) {
        summary.skipped += 1;
        continue;
      }

      const normalizedTitle = normalizeTitle(title);
      const existingByExternalId = await findGameByExternalId(importedGame.externalSource, importedGame.externalId);
      const existingGame =
        existingByExternalId ?? knownGames.find((game) => game.normalizedTitle === normalizedTitle);

      if (existingGame) {
        const updateResult = await updateExistingImportedGame(existingGame, importedGame);
        await attachExternalIdToExistingGame(existingGame.id, importedGame);
        summary.existing += 1;
        if (updateResult.changed) summary.updated += 1;
        if (updateResult.platformsChanged) summary.platformsUpdated += 1;
        continue;
      }

      const createdGame = await createImportedGame(importedGame, normalizedTitle);
      await replaceGameGenres(createdGame.id, importedGame.genreNames);
      await replaceGamePlatforms(createdGame.id, importedGame.platformNames);
      const duplicateCount = await createDuplicateCandidatesForImportedGame(createdGame, knownGames);
      summary.duplicateCandidates += duplicateCount;
      knownGames.push(createdGame);
      summary.added += 1;
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

export async function mergeDuplicateGames(primaryGameId: number, secondaryGameId: number): Promise<Game> {
  return runDatabaseWrite(() => mergeDuplicateGamesNative(primaryGameId, secondaryGameId));
}

async function mergeDuplicateGamesNative(primaryGameId: number, secondaryGameId: number): Promise<Game> {
  if (primaryGameId === secondaryGameId) {
    throw new Error("Cannot merge a game with itself");
  }

  const games = await findAllGames();
  const primaryGame = games.find((game) => game.id === primaryGameId);
  const secondaryGame = games.find((game) => game.id === secondaryGameId);

  if (!primaryGame || !secondaryGame) {
    throw new Error("Duplicate merge target not found");
  }

  const database = await getDatabase();
  const mergedGenres = mergeNameLists(primaryGame.genreNames, secondaryGame.genreNames);
  const mergedPlatforms = mergeNameLists(primaryGame.platformNames, secondaryGame.platformNames);
  const coverPath = getBestCoverPath(primaryGame, secondaryGame);
  const usePlaceholderCover = getMergedUsePlaceholderCover(primaryGame, secondaryGame, coverPath);
  const mergedNotes = mergeNotes(primaryGame.notes, secondaryGame.notes);

  await closeDatabaseConnection();

  await invoke("merge_duplicate_games_native", {
    input: {
      primaryGameId: primaryGame.id,
      secondaryGameId: secondaryGame.id,
      releaseYear: primaryGame.releaseYear ?? secondaryGame.releaseYear,
      coverPath,
      usePlaceholderCover,
      personalRating: primaryGame.personalRating ?? secondaryGame.personalRating,
      notes: mergedNotes,
      estimatedLength: getPreferredKnownValue(primaryGame.estimatedLength, secondaryGame.estimatedLength, "unknown"),
      turkishLanguageSupport: getPreferredKnownValue(
        primaryGame.turkishLanguageSupport,
        secondaryGame.turkishLanguageSupport,
        "unknown",
      ),
      turkishPatchAvailable: primaryGame.turkishPatchAvailable || secondaryGame.turkishPatchAvailable,
      isPlayed: primaryGame.isPlayed || secondaryGame.isPlayed,
      isCompleted: primaryGame.isCompleted || secondaryGame.isCompleted,
      isFavorite: primaryGame.isFavorite || secondaryGame.isFavorite,
      isCurrentlyPlaying: primaryGame.isCurrentlyPlaying || secondaryGame.isCurrentlyPlaying,
      isAbandoned: primaryGame.isAbandoned || secondaryGame.isAbandoned,
      isInstalled: primaryGame.isInstalled || secondaryGame.isInstalled,
      neverShowInRandom: primaryGame.neverShowInRandom || secondaryGame.neverShowInRandom,
      multiplayerType: getPreferredKnownValue(primaryGame.multiplayerType, secondaryGame.multiplayerType, "unknown"),
      steamDeckCompatible: getPreferredKnownValue(
        primaryGame.steamDeckCompatible,
        secondaryGame.steamDeckCompatible,
        "unknown",
      ),
      steamAppId: primaryGame.steamAppId ?? secondaryGame.steamAppId,
      isWishlisted: primaryGame.isWishlisted || secondaryGame.isWishlisted,
      genreNames: mergedGenres,
      platformNames: mergedPlatforms,
    },
  });

  const mergedGame = await findGameById(primaryGame.id);
  if (!mergedGame) {
    throw new Error("Merged game not found");
  }

  return mergedGame;
}

export async function findDismissedDuplicatePairs() {
  const database = await getDatabase();
  const rows = await database.select<Array<{ game_a_id: number; game_b_id: number }>>(
    "SELECT game_a_id, game_b_id FROM duplicate_candidates WHERE status IN ('dismissed', 'merged')",
  );

  return rows.map((row) => [row.game_a_id, row.game_b_id] as const);
}

export async function dismissDuplicateCandidate(gameAId: number, gameBId: number) {
  const database = await getDatabase();
  const [firstId, secondId] = gameAId < gameBId ? [gameAId, gameBId] : [gameBId, gameAId];

  await database.execute(
    `
      INSERT INTO duplicate_candidates (game_a_id, game_b_id, reason, confidence, status)
      VALUES ($1, $2, 'Name similarity', 1, 'dismissed')
    `,
    [firstId, secondId],
  );
}

async function attachSteamToExistingGame(game: Game, steamAppId: number) {
  const database = await getDatabase();

  await database.execute(
    `
      UPDATE games
      SET
        steam_app_id = COALESCE(steam_app_id, $1),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
    [steamAppId, game.id],
  );
  await replaceGamePlatforms(game.id, mergeNameLists(game.platformNames, ["Steam"]));
}

async function attachExternalIdToExistingGame(gameId: number, input: ImportedGameInput) {
  if (!input.externalSource || !input.externalId) return;

  const database = await getDatabase();
  await database.execute(
    `
      UPDATE games
      SET
        external_source = COALESCE(external_source, $1),
        external_id = COALESCE(external_id, $2),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND (external_id IS NULL OR external_id = $2)
    `,
    [input.externalSource, input.externalId, gameId],
  );
}

async function createSteamGame(input: SteamGameImportInput, normalizedTitle: string) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT INTO games (
        title,
        normalized_title,
        release_year,
        cover_path,
        use_placeholder_cover,
        personal_rating,
        notes,
        estimated_length,
        is_played,
        is_completed,
        is_favorite,
        is_currently_playing,
        is_abandoned,
        is_installed,
        never_show_in_random,
        multiplayer_type,
        steam_deck_compatible,
        source,
        steam_app_id
      )
      VALUES ($1, $2, NULL, $3, $4, NULL, NULL, 'unknown', 0, 0, 0, 0, 0, 0, 0, 'unknown', 'unknown', 'steam', $5)
    `,
    [input.name.trim(), normalizedTitle, input.coverPath, Number(!input.coverPath), input.appId],
  );

  const createdGame = await findGameBySteamAppId(input.appId);
  if (!createdGame) {
    throw new Error("Steam game could not be created");
  }

  return createdGame;
}

async function updateExistingImportedGame(game: Game, input: ImportedGameInput) {
  const database = await getDatabase();
  const nextPlatforms = mergeNameLists(game.platformNames, input.platformNames);
  const nextGenres = mergeNameLists(game.genreNames, input.genreNames);
  const platformsChanged = !areNameListsEqual(game.platformNames, nextPlatforms);
  const genresChanged = !areNameListsEqual(game.genreNames, nextGenres);

  await database.execute(
    `
      UPDATE games
      SET
        release_year = COALESCE(release_year, $1),
        cover_path = COALESCE(cover_path, $2),
        use_placeholder_cover = CASE WHEN $2 IS NOT NULL THEN 0 ELSE use_placeholder_cover END,
        personal_rating = COALESCE(personal_rating, $3),
        notes = CASE
          WHEN $4 IS NOT NULL
            AND (notes IS NULL OR notes NOT LIKE '%Yüklü oyun taramasında bulundu:%')
          THEN CASE
            WHEN notes IS NULL OR TRIM(notes) = '' THEN $4
            ELSE notes || CHAR(10) || $4
          END
          ELSE notes
        END,
        is_played = CASE WHEN $5 = 1 THEN 1 ELSE is_played END,
        is_completed = CASE WHEN $6 = 1 THEN 1 ELSE is_completed END,
        is_favorite = CASE WHEN $7 = 1 THEN 1 ELSE is_favorite END,
        is_installed = CASE WHEN $8 = 1 THEN 1 ELSE is_installed END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `,
    [
      input.releaseYear,
      input.coverPath,
      input.personalRating,
      input.notes,
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isInstalled),
      game.id,
    ],
  );
  await replaceGameGenres(game.id, nextGenres);
  await replaceGamePlatforms(game.id, nextPlatforms);

  return {
    changed:
      platformsChanged ||
      genresChanged ||
      Boolean(input.releaseYear && !game.releaseYear) ||
      Boolean(input.coverPath && !game.coverPath) ||
      Boolean(input.personalRating && !game.personalRating) ||
      Boolean(input.notes && !game.notes) ||
      (input.isPlayed && !game.isPlayed) ||
      (input.isCompleted && !game.isCompleted) ||
      (input.isFavorite && !game.isFavorite) ||
      (input.isInstalled && !game.isInstalled),
    platformsChanged,
  };
}

async function createImportedGame(input: ImportedGameInput, normalizedTitle: string) {
  const database = await getDatabase();

  await database.execute(
    `
      INSERT INTO games (
        title,
        normalized_title,
        release_year,
        cover_path,
        use_placeholder_cover,
        personal_rating,
        notes,
        estimated_length,
        is_played,
        is_completed,
        is_favorite,
        is_currently_playing,
        is_abandoned,
        is_installed,
        never_show_in_random,
        multiplayer_type,
        steam_deck_compatible,
        source,
        steam_app_id,
        external_source,
        external_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'unknown', $8, $9, $10, 0, 0, $11, 0, 'unknown', 'unknown', 'import', NULL, $12, $13)
    `,
    [
      input.title.trim(),
      normalizedTitle,
      input.releaseYear,
      input.coverPath,
      Number(!input.coverPath),
      input.personalRating,
      input.notes,
      Number(input.isPlayed),
      Number(input.isCompleted),
      Number(input.isFavorite),
      Number(input.isInstalled),
      input.externalSource,
      input.externalId,
    ],
  );

  const createdGame = await findGameByNormalizedTitle(normalizedTitle);
  if (!createdGame) {
    throw new Error("Imported game could not be created");
  }

  return createdGame;
}

async function findGameBySteamAppId(steamAppId: number): Promise<Game | null> {
  const games = await findAllGames();
  return games.find((game) => game.steamAppId === steamAppId) ?? null;
}

async function findGameByExternalId(externalSource: string | null, externalId: string | null): Promise<Game | null> {
  if (!externalSource || !externalId) return null;

  const database = await getDatabase();
  const rows = await database.select<Array<{ id: number }>>(
    `
      SELECT id
      FROM games
      WHERE external_source = $1
        AND external_id = $2
      LIMIT 1
    `,
    [externalSource, externalId],
  );

  const id = rows[0]?.id;
  return id ? findGameById(id) : null;
}

async function createDuplicateCandidatesForSteamGame(game: Game, existingGames: Game[]) {
  let count = 0;

  for (const existingGame of existingGames) {
    if (existingGame.steamAppId === game.steamAppId) continue;

    const confidence = getTitleSimilarity(game.title, existingGame.title);
    if (confidence < 0.72) continue;

    await insertDuplicateCandidate(game.id, existingGame.id, "Steam import name similarity", confidence);
    count += 1;
  }

  return count;
}

async function createDuplicateCandidatesForImportedGame(game: Game, existingGames: Game[]) {
  let count = 0;

  for (const existingGame of existingGames) {
    const confidence = getTitleSimilarity(game.title, existingGame.title);
    if (confidence < 0.72) continue;

    await insertDuplicateCandidate(game.id, existingGame.id, "File import name similarity", confidence);
    count += 1;
  }

  return count;
}

async function insertDuplicateCandidate(gameAId: number, gameBId: number, reason: string, confidence: number) {
  const database = await getDatabase();
  const [firstId, secondId] = gameAId < gameBId ? [gameAId, gameBId] : [gameBId, gameAId];

  await database.execute(
    `
      INSERT INTO duplicate_candidates (game_a_id, game_b_id, reason, confidence, status)
      SELECT $1, $2, $3, $4, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM duplicate_candidates
        WHERE game_a_id = $1
          AND game_b_id = $2
          AND status IN ('pending', 'merged', 'dismissed')
      )
    `,
    [firstId, secondId, reason, confidence],
  );
}

function mapGameRow(row: GameRow): Game {
  const hasCoverPath = typeof row.cover_path === "string" && row.cover_path.trim().length > 0;

  return {
    id: row.id,
    title: row.title,
    normalizedTitle: row.normalized_title,
    releaseYear: row.release_year,
    coverPath: hasCoverPath ? row.cover_path : null,
    usePlaceholderCover: hasCoverPath ? false : Boolean(row.use_placeholder_cover),
    personalRating: row.personal_rating,
    notes: row.notes,
    estimatedLength: row.estimated_length ?? "unknown",
    turkishLanguageSupport: row.turkish_language_support ?? "unknown",
    turkishPatchAvailable: Boolean(row.turkish_patch_available),
    isPlayed: Boolean(row.is_played),
    isCompleted: Boolean(row.is_completed),
    isFavorite: Boolean(row.is_favorite),
    isCurrentlyPlaying: Boolean(row.is_currently_playing),
    isAbandoned: Boolean(row.is_abandoned),
    isInstalled: Boolean(row.is_installed),
    isWishlisted: Boolean(row.is_wishlisted),
    neverShowInRandom: Boolean(row.never_show_in_random),
    multiplayerType: row.multiplayer_type,
    steamDeckCompatible: row.steam_deck_compatible,
    source: row.source,
    steamAppId: row.steam_app_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    genreNames: splitJoinedNames(row.genre_names),
    platformNames: splitJoinedNames(row.platform_names),
  };
}

function splitJoinedNames(value: string | null | undefined) {
  return value ? value.split("||").filter(Boolean).sort((a, b) => a.localeCompare(b, "tr")) : [];
}

function mergeNameLists(first: string[] = [], second: string[] = []) {
  return Array.from(new Set([...first, ...second])).sort((a, b) => a.localeCompare(b, "tr"));
}

function areNameListsEqual(first: string[] = [], second: string[] = []) {
  const normalizedFirst = mergeNameLists(first);
  const normalizedSecond = mergeNameLists(second);
  return (
    normalizedFirst.length === normalizedSecond.length &&
    normalizedFirst.every((value, index) => value === normalizedSecond[index])
  );
}

function getBestCoverPath(primaryGame: Game, secondaryGame: Game) {
  if (primaryGame.coverPath && !primaryGame.usePlaceholderCover) {
    return primaryGame.coverPath;
  }

  if (secondaryGame.coverPath && !secondaryGame.usePlaceholderCover) {
    return secondaryGame.coverPath;
  }

  return primaryGame.coverPath ?? secondaryGame.coverPath;
}

function getMergedUsePlaceholderCover(primaryGame: Game, secondaryGame: Game, coverPath: string | null) {
  if (!coverPath) return true;
  if (primaryGame.coverPath === coverPath) return primaryGame.usePlaceholderCover;
  if (secondaryGame.coverPath === coverPath) return secondaryGame.usePlaceholderCover;
  return false;
}

function getPreferredKnownValue<T>(primaryValue: T, secondaryValue: T, unknownValue: T) {
  return primaryValue === unknownValue ? secondaryValue : primaryValue;
}

async function syncPrimaryGenresByName(
  database: Awaited<ReturnType<typeof getDatabase>>,
  gameId: number,
  genreNames: string[],
) {
  for (const genreName of genreNames) {
    const cleanName = genreName.trim();
    if (!cleanName) continue;

    await database.execute("INSERT OR IGNORE INTO genres (name) VALUES ($1)", [cleanName]);
    await database.execute(
      `
        INSERT OR IGNORE INTO game_genres (game_id, genre_id)
        SELECT $1, id FROM genres WHERE name = $2
      `,
      [gameId, cleanName],
    );
  }
}

async function syncPrimaryPlatformsByName(
  database: Awaited<ReturnType<typeof getDatabase>>,
  gameId: number,
  platformNames: string[],
) {
  for (const platformName of platformNames) {
    const cleanName = platformName.trim();
    if (!cleanName) continue;

    await database.execute("INSERT OR IGNORE INTO platforms (name, logo_path) VALUES ($1, NULL)", [cleanName]);
    await database.execute(
      `
        INSERT OR IGNORE INTO game_platforms (game_id, platform_id)
        SELECT $1, id FROM platforms WHERE name = $2
      `,
      [gameId, cleanName],
    );
  }
}

function getTitleSimilarity(titleA: string, titleB: string) {
  const normalizedA = normalizeTitle(titleA);
  const normalizedB = normalizeTitle(titleB);
  if (normalizedA === normalizedB) {
    return 1;
  }
  const tokensA = normalizedA.split(" ").filter((token) => token.length > 1);
  const tokensB = normalizedB.split(" ").filter((token) => token.length > 1);
  const intersection = tokensA.filter((token) => tokensB.includes(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  const tokenScore = intersection / union;
  const containsScore = normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA) ? 0.9 : 0;

  return Math.max(tokenScore, containsScore);
}

function mergeNotes(primaryNotes: string | null, secondaryNotes: string | null) {
  const cleanPrimary = primaryNotes?.trim();
  const cleanSecondary = secondaryNotes?.trim();

  if (cleanPrimary && cleanSecondary && cleanPrimary !== cleanSecondary) {
    return `${cleanPrimary}\n\n--- Birleşmeden korunan not ---\n${cleanSecondary}`;
  }

  return cleanPrimary || cleanSecondary || null;
}
