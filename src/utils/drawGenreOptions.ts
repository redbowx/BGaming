import type { Game } from "../types/game";
import { getGenreDisplayName } from "./genreDisplay";

export type DrawGenreOption = {
  key: string;
  label: string;
  matchNames: string[];
};

export const drawGenreOptions: DrawGenreOption[] = [
  createDrawGenre("action", "Aksiyon", ["Action", "Aksiyon", "Action Adventure", "Aksiyon Macera"]),
  createDrawGenre("adventure", "Macera", ["Adventure", "Macera", "Action Adventure", "Aksiyon Macera"]),
  createDrawGenre("rpg", "Rol Yapma", ["RPG", "RYO", "Role-playing", "Role-playing (RPG)", "Rol Yapma"]),
  createDrawGenre("strategy", "Strateji", ["Strategy", "Strateji", "Real-Time Strategy", "RTS", "Turn-Based Strategy"]),
  createDrawGenre("simulation", "Simülasyon", ["Simulation", "Simülasyon", "Management", "Yönetim"]),
  createDrawGenre("sports", "Spor", ["Sports", "Spor", "Football", "Soccer"]),
  createDrawGenre("racing", "Yarış", ["Racing", "Yarış"]),
  createDrawGenre("puzzle", "Bulmaca", ["Puzzle", "Bulmaca"]),
  createDrawGenre("platformer", "Platform", ["Platformer", "Platform"]),
  createDrawGenre("shooter", "Nişancı", ["Shooter", "Nişancı", "FPS", "Third-Person Shooter"]),
  createDrawGenre("horror", "Korku", ["Horror", "Korku", "Survival Horror", "Hayatta Kalma Korku"]),
  createDrawGenre("survival", "Hayatta Kalma", ["Survival", "Hayatta Kalma", "Survival Horror"]),
  createDrawGenre("fighting", "Dövüş", ["Fighting", "Dövüş", "2D Fighting", "2D Dövüş"]),
  createDrawGenre("sandbox", "Sandbox", ["Sandbox", "Open World", "Açık Dünya"]),
  createDrawGenre("roguelike", "Roguelike", ["Roguelike", "Roguelite"]),
  createDrawGenre("card", "Kart Oyunu", ["Card", "Card Game", "Kart Oyunu"]),
  createDrawGenre("moba", "MOBA", ["MOBA"]),
  createDrawGenre("battleRoyale", "Battle Royale", ["Battle Royale"]),
];

export const defaultDrawGenreKeys = drawGenreOptions.map((option) => option.key);

const drawGenreOptionMap = new Map(drawGenreOptions.map((option) => [option.key, option]));

export function getEnabledDrawGenreOptions(keys: string[] = defaultDrawGenreKeys) {
  const cleanKeys = sanitizeDrawGenreKeys(keys);
  return cleanKeys.map((key) => drawGenreOptionMap.get(key)).filter((option): option is DrawGenreOption => Boolean(option));
}

export function sanitizeDrawGenreKeys(keys: string[] = defaultDrawGenreKeys) {
  const allowedKeys = new Set(drawGenreOptions.map((option) => option.key));
  const cleanKeys = keys.filter((key) => allowedKeys.has(key));
  return cleanKeys.length > 0 ? Array.from(new Set(cleanKeys)) : defaultDrawGenreKeys;
}

export function parseDrawGenreKeys(value: string | undefined) {
  if (!value?.trim()) {
    return defaultDrawGenreKeys;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return sanitizeDrawGenreKeys(parsed.filter((item): item is string => typeof item === "string"));
    }
  } catch {
    return sanitizeDrawGenreKeys(value.split(",").map((item) => item.trim()));
  }

  return defaultDrawGenreKeys;
}

export function serializeDrawGenreKeys(keys: string[]) {
  return JSON.stringify(sanitizeDrawGenreKeys(keys));
}

export function gameMatchesDrawGenre(game: Game, option: DrawGenreOption) {
  const gameGenreKeys = new Set((game.genreNames ?? []).flatMap((genreName) => genreLookupKeys(genreName)));
  return option.matchNames.some((genreName) => gameGenreKeys.has(normalizeGenreLookupName(genreName)));
}

export function gameMatchesAnyDrawGenre(game: Game, keys: string[]) {
  return getEnabledDrawGenreOptions(keys).some((option) => gameMatchesDrawGenre(game, option));
}

function createDrawGenre(key: string, label: string, matchNames: string[]): DrawGenreOption {
  return {
    key,
    label,
    matchNames: Array.from(new Set([label, ...matchNames].flatMap(genreLookupKeys))),
  };
}

function genreLookupKeys(genreName: string) {
  const displayName = getGenreDisplayName(genreName);
  return [genreName, displayName].map(normalizeGenreLookupName);
}

function normalizeGenreLookupName(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
