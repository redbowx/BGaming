import { getGames } from "./gameService";
import type { Game, GameSource } from "../types/game";
import { getGenreDisplayName } from "../utils/genreDisplay";

export type DistributionItem = {
  label: string;
  count: number;
};

export type LibraryStats = {
  totalGames: number;
  favoriteGames: number;
  playedGames: number;
  unplayedGames: number;
  completedGames: number;
  currentlyPlayingGames: number;
  abandonedGames: number;
  installedGames: number;
  manualGames: number;
  steamGames: number;
  importGames: number;
  ratedGames: number;
  averagePersonalRating: number | null;
  platformDistribution: DistributionItem[];
  genreDistribution: DistributionItem[];
  yearDistribution: DistributionItem[];
};

export async function getLibraryStats(): Promise<LibraryStats> {
  const games = await getGames();
  return calculateLibraryStats(games);
}

export function calculateLibraryStats(games: Game[]): LibraryStats {
  const ratedGames = games.filter((game) => game.personalRating !== null);

  return {
    totalGames: games.length,
    favoriteGames: games.filter((game) => game.isFavorite).length,
    playedGames: games.filter((game) => game.isPlayed).length,
    unplayedGames: games.filter((game) => !game.isPlayed).length,
    completedGames: games.filter((game) => game.isCompleted).length,
    currentlyPlayingGames: games.filter((game) => game.isCurrentlyPlaying).length,
    abandonedGames: games.filter((game) => game.isAbandoned).length,
    installedGames: games.filter((game) => game.isInstalled).length,
    manualGames: countBySource(games, "manual"),
    steamGames: countBySource(games, "steam"),
    importGames: countBySource(games, "import"),
    ratedGames: ratedGames.length,
    averagePersonalRating: getAverageRating(ratedGames),
    platformDistribution: getNameDistribution(games, "platformNames", "Platform yok"),
    genreDistribution: getNameDistribution(games, "genreNames", "Tür yok", getGenreDisplayName),
    yearDistribution: getYearDistribution(games),
  };
}

function getAverageRating(games: Game[]) {
  if (games.length === 0) return null;

  const total = games.reduce((sum, game) => sum + (game.personalRating ?? 0), 0);
  return Math.round((total / games.length) * 10) / 10;
}

function countBySource(games: Game[], source: GameSource) {
  return games.filter((game) => game.source === source).length;
}

function getNameDistribution(
  games: Game[],
  key: "platformNames" | "genreNames",
  emptyLabel: string,
  displayName: (value: string) => string = (value) => value,
) {
  const counts = new Map<string, number>();

  for (const game of games) {
    const names = game[key] ?? [];

    if (names.length === 0) {
      addCount(counts, emptyLabel);
      continue;
    }

    for (const name of names) {
      addCount(counts, displayName(name));
    }
  }

  return sortDistribution(counts);
}

function getYearDistribution(games: Game[]) {
  const counts = new Map<string, number>();

  for (const game of games) {
    addCount(counts, game.releaseYear ? String(game.releaseYear) : "Yıl yok");
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.label === "Yıl yok") return 1;
      if (b.label === "Yıl yok") return -1;
      return Number(a.label) - Number(b.label);
    });
}

function addCount(counts: Map<string, number>, label: string) {
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

function sortDistribution(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));
}
