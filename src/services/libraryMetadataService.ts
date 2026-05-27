import { findAllGenres } from "../database/repositories/genreRepository";
import { findAllPlatforms } from "../database/repositories/platformRepository";
import { ensureDatabaseReady } from "../database/ready";
import type { Genre, Platform } from "../types/game";
import { isTauriRuntime } from "../utils/tauriRuntime";
import { devGames } from "./devGameData";

export async function getGenres(): Promise<Genre[]> {
  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    return findAllGenres();
  }

  return namesToRecords(collectNames("genreNames"));
}

export async function getPlatforms(): Promise<Platform[]> {
  if (isTauriRuntime()) {
    await ensureDatabaseReady();
    return findAllPlatforms();
  }

  return namesToRecords(collectNames("platformNames")).map((record) => ({
    ...record,
    logoPath: null,
  }));
}

function collectNames(key: "genreNames" | "platformNames") {
  return [...new Set(devGames.flatMap((game) => game[key] ?? []))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
}

function namesToRecords(names: string[]) {
  return names.map((name, index) => ({
    id: index + 1,
    name,
  }));
}
