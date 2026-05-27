import {
  dismissDuplicateCandidate,
  findDismissedDuplicatePairs,
  mergeDuplicateGames,
} from "../database/repositories/gameRepository";
import { getGames } from "./gameService";
import { devGames } from "./devGameData";
import type { Game } from "../types/game";
import { isUsefulGenreName } from "../utils/genreDisplay";
import { normalizeTitle } from "../utils/normalizeTitle";
import { isTauriRuntime } from "../utils/tauriRuntime";
import { ensureDatabaseReady } from "../database/ready";

export type DuplicateSuspicion = {
  id: string;
  gameA: Game;
  gameB: Game;
  confidence: number;
  reason: string;
};

export type CollectionHealthReport = {
  missingCovers: Game[];
  missingGenres: Game[];
  missingYears: Game[];
  missingPlatforms: Game[];
  missingTurkishLanguage: Game[];
  duplicateSuspicions: DuplicateSuspicion[];
};

const dismissedPairs = new Set<string>();

export async function getCollectionHealthReport(): Promise<CollectionHealthReport> {
  const games = await getGames();
  const duplicateSuspicions = await findDuplicateSuspicions(games);

  return {
    missingCovers: games.filter((game) => !hasStoredCover(game)),
    missingGenres: games.filter((game) => (game.genreNames ?? []).filter(isUsefulGenreName).length === 0),
    missingYears: games.filter((game) => game.releaseYear === null),
    missingPlatforms: games.filter((game) => (game.platformNames ?? []).length === 0),
    missingTurkishLanguage: games.filter((game) => game.turkishLanguageSupport === "unknown"),
    duplicateSuspicions,
  };
}

function hasStoredCover(game: Game) {
  const coverPath = game.coverPath?.trim();
  if (!coverPath || game.usePlaceholderCover) {
    return false;
  }

  return !isKnownBadAutoCover(coverPath);
}

function isKnownBadAutoCover(coverPath: string) {
  return /metadata-sgdb-public-/i.test(coverPath.replace(/\\/g, "/"));
}

export async function dismissDuplicate(gameAId: number, gameBId: number) {
  dismissedPairs.add(pairKey(gameAId, gameBId));

  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    await dismissDuplicateCandidate(gameAId, gameBId);
  }
}

export async function mergeDuplicate(primaryGameId: number, secondaryGameId: number): Promise<Game> {
  dismissedPairs.add(pairKey(primaryGameId, secondaryGameId));

  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    return mergeDuplicateGames(primaryGameId, secondaryGameId);
  }

  return mergeDevDuplicateGames(primaryGameId, secondaryGameId);
}

async function findDuplicateSuspicions(games: Game[]) {
  const dismissed = await getDismissedPairKeys();
  const suspicions: DuplicateSuspicion[] = [];

  for (let i = 0; i < games.length; i += 1) {
    for (let j = i + 1; j < games.length; j += 1) {
      const gameA = games[i];
      const gameB = games[j];
      const key = pairKey(gameA.id, gameB.id);
      if (dismissed.has(key)) continue;

      const confidence = getNameSimilarity(gameA.title, gameB.title);
      if (confidence < 1 && !hasComparableTokenOverlap(gameA.title, gameB.title)) continue;
      if (confidence >= 0.72) {
        suspicions.push({
          id: key,
          gameA,
          gameB,
          confidence,
          reason: "Benzer oyun adı",
        });
      }
    }
  }

  return suspicions.sort((a, b) => b.confidence - a.confidence);
}

function hasComparableTokenOverlap(titleA: string, titleB: string) {
  const tokensA = getComparableTokens(titleA);
  const tokensB = getComparableTokens(titleB);

  return tokensA.some((token) => tokensB.includes(token));
}

async function getDismissedPairKeys() {
  const keys = new Set(dismissedPairs);

  if (isTauriRuntime()) {
    const pairs = await findDismissedDuplicatePairs();
    for (const [gameAId, gameBId] of pairs) {
      keys.add(pairKey(gameAId, gameBId));
    }
  }

  return keys;
}

function pairKey(gameAId: number, gameBId: number) {
  return gameAId < gameBId ? `${gameAId}:${gameBId}` : `${gameBId}:${gameAId}`;
}

function getNameSimilarity(titleA: string, titleB: string) {
  const tokensA = getComparableTokens(titleA);
  const tokensB = getComparableTokens(titleB);
  const intersection = tokensA.filter((token) => tokensB.includes(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  const tokenScore = intersection / union;
  const normalizedA = normalizeTitle(titleA);
  const normalizedB = normalizeTitle(titleB);
  if (normalizedA === normalizedB) {
    return 1;
  }
  const containsScore =
    normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA) ? 0.9 : 0;

  return Math.max(tokenScore, containsScore);
}

function getComparableTokens(title: string) {
  const ignored = new Set(["the", "a", "an", "edition", "complete", "definitive", "game", "of"]);

  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length > 1 && !ignored.has(token));
}

function mergeDevDuplicateGames(primaryGameId: number, secondaryGameId: number) {
  const primaryIndex = devGames.findIndex((game) => game.id === primaryGameId);
  const secondaryIndex = devGames.findIndex((game) => game.id === secondaryGameId);

  if (primaryIndex < 0 || secondaryIndex < 0 || primaryIndex === secondaryIndex) {
    throw new Error("Duplicate merge target not found");
  }

  const primaryGame = devGames[primaryIndex];
  const secondaryGame = devGames[secondaryIndex];
  const mergedGame: Game = {
    ...primaryGame,
    releaseYear: primaryGame.releaseYear ?? secondaryGame.releaseYear,
    coverPath: getBestCoverPath(primaryGame, secondaryGame),
    usePlaceholderCover: !getBestCoverPath(primaryGame, secondaryGame),
    personalRating: primaryGame.personalRating ?? secondaryGame.personalRating,
    notes: mergeNotes(primaryGame.notes, secondaryGame.notes),
    estimatedLength:
      primaryGame.estimatedLength === "unknown" ? secondaryGame.estimatedLength : primaryGame.estimatedLength,
    isPlayed: primaryGame.isPlayed || secondaryGame.isPlayed,
    isCompleted: primaryGame.isCompleted || secondaryGame.isCompleted,
    isFavorite: primaryGame.isFavorite || secondaryGame.isFavorite,
    isCurrentlyPlaying: primaryGame.isCurrentlyPlaying || secondaryGame.isCurrentlyPlaying,
    isAbandoned: primaryGame.isAbandoned || secondaryGame.isAbandoned,
    isInstalled: primaryGame.isInstalled || secondaryGame.isInstalled,
    isWishlisted: primaryGame.isWishlisted || secondaryGame.isWishlisted,
    neverShowInRandom: primaryGame.neverShowInRandom || secondaryGame.neverShowInRandom,
    multiplayerType:
      primaryGame.multiplayerType === "unknown" ? secondaryGame.multiplayerType : primaryGame.multiplayerType,
    steamDeckCompatible:
      primaryGame.steamDeckCompatible === "unknown"
        ? secondaryGame.steamDeckCompatible
        : primaryGame.steamDeckCompatible,
    turkishLanguageSupport:
      primaryGame.turkishLanguageSupport === "unknown"
        ? secondaryGame.turkishLanguageSupport
        : primaryGame.turkishLanguageSupport,
    turkishPatchAvailable: primaryGame.turkishPatchAvailable || secondaryGame.turkishPatchAvailable,
    steamAppId: primaryGame.steamAppId ?? secondaryGame.steamAppId,
    genreNames: mergeNameLists(primaryGame.genreNames, secondaryGame.genreNames),
    platformNames: mergeNameLists(primaryGame.platformNames, secondaryGame.platformNames),
    updatedAt: new Date().toISOString(),
  };

  devGames[primaryIndex] = mergedGame;
  devGames.splice(secondaryIndex, 1);

  return mergedGame;
}

function mergeNameLists(first: string[] = [], second: string[] = []) {
  return Array.from(new Set([...first, ...second])).sort((a, b) => a.localeCompare(b, "tr"));
}

function getBestCoverPath(primaryGame: Game, secondaryGame: Game) {
  if (primaryGame.coverPath && !primaryGame.usePlaceholderCover) return primaryGame.coverPath;
  if (secondaryGame.coverPath && !secondaryGame.usePlaceholderCover) return secondaryGame.coverPath;
  return primaryGame.coverPath ?? secondaryGame.coverPath;
}

function mergeNotes(primaryNotes: string | null, secondaryNotes: string | null) {
  const cleanPrimary = primaryNotes?.trim();
  const cleanSecondary = secondaryNotes?.trim();

  if (cleanPrimary && cleanSecondary && cleanPrimary !== cleanSecondary) {
    return `${cleanPrimary}\n\n--- Birleşmeden korunan not ---\n${cleanSecondary}`;
  }

  return cleanPrimary || cleanSecondary || null;
}
