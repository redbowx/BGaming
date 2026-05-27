import { countGames, insertGame } from "./repositories/gameRepository";
import { insertGenre, linkGameToGenre } from "./repositories/genreRepository";
import { insertPlatform, linkGameToPlatform } from "./repositories/platformRepository";
import { normalizeTitle } from "../utils/normalizeTitle";
import type { NewGameInput } from "../types/game";

type SeedGame = NewGameInput & {
  platforms: string[];
  genres: string[];
};

const seedGames: SeedGame[] = [
  {
    title: "Hades",
    normalizedTitle: normalizeTitle("Hades"),
    releaseYear: 2020,
    coverPath: null,
    usePlaceholderCover: true,
    personalRating: 9,
    notes: "Ideal for short sessions and high replay value.",
    estimatedLength: "short",
    isPlayed: true,
    isCompleted: true,
    isFavorite: true,
    isCurrentlyPlaying: false,
    isAbandoned: false,
    isInstalled: true,
    isWishlisted: false,
    neverShowInRandom: false,
    multiplayerType: "singleplayer",
    steamDeckCompatible: "yes",
    source: "manual",
    steamAppId: 1145360,
    platforms: ["PC", "Steam Deck"],
    genres: ["Roguelike", "Aksiyon"],
  },
  {
    title: "Baldur's Gate 3",
    normalizedTitle: normalizeTitle("Baldur's Gate 3"),
    releaseYear: 2023,
    coverPath: null,
    usePlaceholderCover: true,
    personalRating: null,
    notes: "Reserved for long RPG sessions.",
    estimatedLength: "long",
    isPlayed: true,
    isCompleted: false,
    isFavorite: true,
    isCurrentlyPlaying: true,
    isAbandoned: false,
    isInstalled: true,
    isWishlisted: false,
    neverShowInRandom: false,
    multiplayerType: "both",
    steamDeckCompatible: "yes",
    source: "manual",
    steamAppId: 1086940,
    platforms: ["PC"],
    genres: ["RPG", "Strateji"],
  },
  {
    title: "Stardew Valley",
    normalizedTitle: normalizeTitle("Stardew Valley"),
    releaseYear: 2016,
    coverPath: null,
    usePlaceholderCover: true,
    personalRating: 8,
    notes: "For relaxed game nights.",
    estimatedLength: "medium",
    isPlayed: true,
    isCompleted: false,
    isFavorite: false,
    isCurrentlyPlaying: false,
    isAbandoned: false,
    isInstalled: false,
    isWishlisted: false,
    neverShowInRandom: false,
    multiplayerType: "both",
    steamDeckCompatible: "yes",
    source: "manual",
    steamAppId: 413150,
    platforms: ["PC", "Nintendo Switch"],
    genres: ["Simulation", "Cozy"],
  },
  {
    title: "Disco Elysium",
    normalizedTitle: normalizeTitle("Disco Elysium"),
    releaseYear: 2019,
    coverPath: null,
    usePlaceholderCover: true,
    personalRating: null,
    notes: "aeep in the story-focused recommendation pool.",
    estimatedLength: "long",
    isPlayed: false,
    isCompleted: false,
    isFavorite: false,
    isCurrentlyPlaying: false,
    isAbandoned: false,
    isInstalled: false,
    isWishlisted: true,
    neverShowInRandom: false,
    multiplayerType: "singleplayer",
    steamDeckCompatible: "yes",
    source: "manual",
    steamAppId: 632470,
    platforms: ["PC"],
    genres: ["RPG", "Dedektif"],
  },
  {
    title: "Old Competitive Shooter",
    normalizedTitle: normalizeTitle("Old Competitive Shooter"),
    releaseYear: 2014,
    coverPath: null,
    usePlaceholderCover: true,
    personalRating: 5,
    notes: "Do not show in random recommendations.",
    estimatedLength: "short",
    isPlayed: true,
    isCompleted: false,
    isFavorite: false,
    isCurrentlyPlaying: false,
    isAbandoned: true,
    isInstalled: false,
    isWishlisted: false,
    neverShowInRandom: true,
    multiplayerType: "multiplayer",
    steamDeckCompatible: "unknown",
    source: "import",
    steamAppId: null,
    platforms: ["PC"],
    genres: ["FPS", "Competitive"],
  },
];

export async function seedDevelopmentData() {
  const totalGames = await countGames();

  if (totalGames > 0) {
    return;
  }

  const platforms = new Set(seedGames.flatMap((game) => game.platforms));
  const genres = new Set(seedGames.flatMap((game) => game.genres));

  for (const platform of platforms) {
    await insertPlatform(platform);
  }

  for (const genre of genres) {
    await insertGenre(genre);
  }

  for (const game of seedGames) {
    const { platforms: gamePlatforms, genres: gameGenres, ...input } = game;

    await insertGame(input);

    for (const platform of gamePlatforms) {
      await linkGameToPlatform(game.normalizedTitle, platform);
    }

    for (const genre of gameGenres) {
      await linkGameToGenre(game.normalizedTitle, genre);
    }
  }
}
