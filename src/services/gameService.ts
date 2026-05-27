import type { Game, GameFormInput, GameUpdateInput } from "../types/game";
import {
  countGamesUsingCover,
  createGame,
  deleteGame,
  findAllGames,
  findRandomEligibleGame,
  updateGame,
  updateGameForm,
} from "../database/repositories/gameRepository";
import { deleteStoredCover } from "./coverService";
import { devGames } from "./devGameData";
import { isTauriRuntime } from "../utils/tauriRuntime";
import { normalizeTitle } from "../utils/normalizeTitle";
import { ensureDatabaseReady } from "../database/ready";
import { checkInstalledGameStates, writeGameInstallPath } from "./gameLaunchService";

export async function getGames(): Promise<Game[]> {
  if (!isTauriRuntime()) {
    return devGames;
  }

  await ensureDatabaseReady();
  return findAllGames();
}

export async function getRandomRecommendation(): Promise<Game | null> {
  if (!isTauriRuntime()) {
    return devGames.find((game) => !game.neverShowInRandom && !game.isAbandoned) ?? null;
  }

  await ensureDatabaseReady();
  return findRandomEligibleGame();
}

export async function getFavoriteGames(): Promise<Game[]> {
  const games = await getGames();
  return games.filter((game) => game.isFavorite);
}

export async function reconcileInstalledGameStates(games: Game[]): Promise<Game[]> {
  if (!isTauriRuntime()) {
    return games;
  }

  const installedGames = games.filter((game) => game.isInstalled);
  if (installedGames.length === 0) {
    return games;
  }

  await ensureDatabaseReady();
  const states = await checkInstalledGameStates(installedGames);
  const missingIds = new Set(
    states
      .filter((state) => !state.isInstalled)
      .map((state) => state.id),
  );

  if (missingIds.size === 0) {
    return games;
  }

  await Promise.all(
    games
      .filter((game) => missingIds.has(game.id))
      .map((game) =>
        updateGame({
          id: game.id,
          isPlayed: game.isPlayed,
          isCompleted: game.isCompleted,
          isFavorite: game.isFavorite,
          isCurrentlyPlaying: game.isCurrentlyPlaying,
          isAbandoned: game.isAbandoned,
          isWishlisted: game.isWishlisted,
          neverShowInRandom: game.neverShowInRandom,
          multiplayerType: game.multiplayerType,
          steamDeckCompatible: game.steamDeckCompatible,
          personalRating: game.personalRating,
          notes: game.notes,
          estimatedLength: game.estimatedLength,
          releaseYear: game.releaseYear,
          isInstalled: false,
          turkishLanguageSupport: game.turkishLanguageSupport,
          turkishPatchAvailable: game.turkishPatchAvailable,
        }),
      ),
  );

  return findAllGames();
}

export async function saveGameDetails(input: GameUpdateInput): Promise<Game> {
  if (!isTauriRuntime()) {
    const gameIndex = devGames.findIndex((game) => game.id === input.id);

    if (gameIndex < 0) {
      throw new Error("Game not found");
    }

    devGames[gameIndex] = {
      ...devGames[gameIndex],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    return devGames[gameIndex];
  }

  await ensureDatabaseReady();
  await updateGame(input);
  const games = await findAllGames();
  const updatedGame = games.find((game) => game.id === input.id);

  if (!updatedGame) {
    throw new Error("Game not found after update");
  }

  return updatedGame;
}

export async function saveGameInstallFolder(game: Game, installPath: string): Promise<Game> {
  return saveGameDetails({
    id: game.id,
    isPlayed: game.isPlayed,
    isCompleted: game.isCompleted,
    isFavorite: game.isFavorite,
    isCurrentlyPlaying: game.isCurrentlyPlaying,
    isAbandoned: game.isAbandoned,
    isWishlisted: game.isWishlisted,
    neverShowInRandom: game.neverShowInRandom,
    multiplayerType: game.multiplayerType,
    steamDeckCompatible: game.steamDeckCompatible,
    personalRating: game.personalRating,
    notes: writeGameInstallPath(game.notes, installPath),
    estimatedLength: game.estimatedLength,
    releaseYear: game.releaseYear,
    isInstalled: true,
  });
}

export async function createManualGame(input: GameFormInput): Promise<Game> {
  if (!isTauriRuntime()) {
    const now = new Date().toISOString();
    const createdGame: Game = {
      ...input,
      id: Math.max(0, ...devGames.map((game) => game.id)) + 1,
      normalizedTitle: normalizeTitle(input.title),
      source: "manual",
      steamAppId: null,
      isInstalled: false,
      createdAt: now,
      updatedAt: now,
    };

    devGames.push(createdGame);
    return createdGame;
  }

  await ensureDatabaseReady();
  return createGame(input);
}

export async function updateManualGame(input: GameFormInput & { id: number }): Promise<Game> {
  if (!isTauriRuntime()) {
    const index = devGames.findIndex((game) => game.id === input.id);
    if (index < 0) throw new Error("Game not found");

    devGames[index] = {
      ...devGames[index],
      ...input,
      normalizedTitle: normalizeTitle(input.title),
      updatedAt: new Date().toISOString(),
    };
    return devGames[index];
  }

  await ensureDatabaseReady();
  return updateGameForm(input);
}

export async function removeGame(game: Game) {
  if (!isTauriRuntime()) {
    const index = devGames.findIndex((item) => item.id === game.id);
    if (index >= 0) devGames.splice(index, 1);
    return;
  }

  await ensureDatabaseReady();
  await deleteGame(game.id);

  if (game.coverPath) {
    const usageCount = await countGamesUsingCover(game.coverPath);
    if (usageCount === 0) {
      await deleteStoredCover(game.coverPath);
    }
  }
}
